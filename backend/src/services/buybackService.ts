/**
 * Buyback Service
 *
 * Executes token buybacks via Bags API after manual claim approval.
 * Flow: Approved claim → get quote → create swap tx → submit → record buyback
 *
 * IMPORTANT: Claims do NOT auto-approve. All approvals go through
 * the manual approval queue (/api/claims/:id/approve).
 */

import { pool } from '../db/db';
import { bagsApi } from './bagsApi';
import { lootgoDistribution } from './lootgoDistribution';
import { config } from '../config';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

export async function executeBuyback(claimId: string): Promise<{
  buybackId: string;
  tokenAmount: number;
  txHash: string;
  distributionResult: { campaignId: string; boxesCreated: number };
}> {
  // 1. Fetch the claim + project
  const claimRes = await pool.query(
    `SELECT c.*, p.token_address, p.project_name, p.project_logo, p.project_description, p.geo_config
     FROM claims c JOIN projects p ON p.id = c.project_id
     WHERE c.id = $1`,
    [claimId]
  );
  if (claimRes.rows.length === 0) throw new Error(`Claim not found: ${claimId}`);
  const claim = claimRes.rows[0];

  if (claim.status !== 'approved') {
    throw new Error(`Claim ${claimId} is not approved (status: ${claim.status})`);
  }

  const solToSpend = parseFloat(claim.player_amount);
  const tokenMint = claim.token_address;

  console.log(`[BuybackService] Executing buyback for claim ${claimId}: ${solToSpend} SOL → ${tokenMint}`);

  try {
    // 2. Get trade quote from Bags API
    const lamports = Math.floor(solToSpend * 1e9);
    const quote = await bagsApi.getTradeQuote(SOL_MINT, tokenMint, lamports, 100);

    console.log(`[BuybackService] Quote: ${solToSpend} SOL → ~${quote.outputAmount} tokens`);

    // 3. Create swap transaction via Bags API
    const swapTx = await bagsApi.createSwapTransaction(quote, config.platformWallet);

    // 4. Submit transaction (Devnet simulation)
    // TODO Production: sign with platform wallet keypair + sendAndConfirmTransaction
    const bagsTxHash = `DEVNET_SWAP_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const tokenAmount = quote.outputAmount || solToSpend * 100;
    console.log(`[BuybackService] [DEVNET] Simulated swap tx: ${bagsTxHash}, tokens: ${tokenAmount}`);

    // 5. Record buyback in DB
    const buybackRes = await pool.query(
      `INSERT INTO buybacks (claim_id, token_amount, sol_spent, bags_tx_hash, executed_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [claimId, tokenAmount, solToSpend, bagsTxHash]
    );
    const buyback = buybackRes.rows[0];

    // 6. Trigger distribution to GPS loot boxes
    const distributionResult = await distributeTokens(buyback.id, tokenMint, tokenAmount, {
      project_name: claim.project_name,
      project_logo: claim.project_logo,
      project_description: claim.project_description,
      geo_config: claim.geo_config,
    });

    return { buybackId: buyback.id, tokenAmount, txHash: bagsTxHash, distributionResult };

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[BuybackService] ❌ Buyback failed for claim ${claimId}: ${errMsg}`);
    throw err;
  }
}

async function distributeTokens(
  buybackId: string,
  tokenMint: string,
  tokenAmount: number,
  project: {
    project_name?: string;
    project_logo?: string;
    project_description?: string;
    geo_config?: any;
  }
): Promise<{ campaignId: string; boxesCreated: number }> {
  console.log(`[BuybackService] Distributing ${tokenAmount} tokens for buyback ${buybackId}`);

  const result = await lootgoDistribution.distributeTokens({
    tokenAddress: tokenMint,
    amount: tokenAmount,
    campaignMeta: {
      projectName: project.project_name || 'Unknown Project',
      projectLogo: project.project_logo,
      projectDescription: project.project_description,
    },
    geoConfig: project.geo_config || { targeting: 'global' },
    expiryHours: 72,
  });

  if (result.boxesCreated > 0) {
    await pool.query(
      `INSERT INTO distributions (buyback_id, lootgo_campaign_id, boxes_created, tokens_distributed, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [buybackId, result.campaignId, result.boxesCreated, tokenAmount]
    ).catch(err => console.error(`[BuybackService] Failed to record distribution: ${err.message}`));
  }

  return { campaignId: result.campaignId, boxesCreated: result.boxesCreated };
}
