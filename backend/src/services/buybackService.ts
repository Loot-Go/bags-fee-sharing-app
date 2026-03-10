/**
 * Buyback Service
 * 
 * Executes token buybacks via Bags API after manual claim approval.
 * Flow: Approved claim → get quote → create swap tx → submit → record buyback
 * 
 * IMPORTANT: Claims do NOT auto-approve. All approvals go through
 * the manual approval queue (/api/claims/:id/approve).
 */

import { Connection, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { supabase } from '../db/supabase';
import { bagsApi } from './bagsApi';
import { lootgoDistribution } from './lootgoDistribution';
import { config } from '../config';

// SOL mint address
const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Execute buyback for an approved claim.
 * Called after manual approval via POST /api/claims/:id/approve
 */
export async function executeBuyback(claimId: string): Promise<{
  buybackId: string;
  tokenAmount: number;
  txHash: string;
  distributionResult: { campaignId: string; boxesCreated: number };
}> {
  // 1. Fetch the claim
  const { data: claim, error: claimErr } = await supabase
    .from('claims')
    .select('*, projects(*)')
    .eq('id', claimId)
    .single();

  if (claimErr || !claim) {
    throw new Error(`Claim not found: ${claimId}`);
  }
  if (claim.status !== 'approved') {
    throw new Error(`Claim ${claimId} is not in approved status (current: ${claim.status})`);
  }

  const project = claim.projects;
  const solToSpend = claim.player_amount;  // SOL allocated for buyback (player portion)
  const tokenMint = project.token_address;

  console.log(`[BuybackService] Executing buyback for claim ${claimId}: ${solToSpend} SOL → ${tokenMint}`);

  try {
    // 2. Get trade quote from Bags API
    //    Endpoint: GET /trade-quote?inputMint=<sol>&outputMint=<token>&amount=<lamports>&slippage=100
    const lamports = Math.floor(solToSpend * 1e9);
    const quote = await bagsApi.getTradeQuote(SOL_MINT, tokenMint, lamports, 100 /* 1% slippage */);

    console.log(`[BuybackService] Quote: ${solToSpend} SOL → ~${quote.outputAmount} tokens (impact: ${quote.priceImpact}%)`);

    // 3. Create swap transaction via Bags API (NOT Jupiter)
    //    Endpoint: POST /swap
    const swapTx = await bagsApi.createSwapTransaction(quote, config.platformWallet);

    // 4. Submit transaction to Solana Devnet
    //    NOTE: In production, sign with platform wallet keypair
    let bagsTxHash = '';

    // TODO: Production signing:
    //   const connection = new Connection(config.solanaRpcUrl, 'confirmed');
    //   const wallet = Keypair.fromSecretKey(bs58.decode(config.platformWalletPrivateKey));
    //   const tx = Transaction.from(Buffer.from(swapTx.transaction, 'base64'));
    //   bagsTxHash = await sendAndConfirmTransaction(connection, tx, [wallet]);

    // DEVNET SIMULATION
    bagsTxHash = `DEVNET_SWAP_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const tokenAmount = quote.outputAmount || solToSpend * 100;  // mock token amount
    console.log(`[BuybackService] [DEVNET] Simulated swap tx: ${bagsTxHash}, tokens: ${tokenAmount}`);

    // 5. Record buyback in DB
    const { data: buyback, error: buybackErr } = await supabase
      .from('buybacks')
      .insert({
        claim_id: claimId,
        token_amount: tokenAmount,
        sol_spent: solToSpend,
        bags_tx_hash: bagsTxHash,
        executed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (buybackErr || !buyback) {
      throw new Error(`Failed to record buyback: ${buybackErr?.message}`);
    }

    // 6. Trigger distribution to GPS loot boxes
    const distributionResult = await distributeTokens(buyback.id, tokenMint, tokenAmount, project);

    return {
      buybackId: buyback.id,
      tokenAmount,
      txHash: bagsTxHash,
      distributionResult,
    };

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[BuybackService] ❌ Buyback failed for claim ${claimId}: ${errMsg}`);
    throw err;
  }
}

/**
 * Distribute purchased tokens as GPS loot boxes via LootGO Distribution API.
 */
async function distributeTokens(
  buybackId: string,
  tokenMint: string,
  tokenAmount: number,
  project: {
    project_name?: string;
    project_logo?: string;
    project_description?: string;
    geo_config?: { targeting: string; regions?: string[] };
  }
): Promise<{ campaignId: string; boxesCreated: number }> {
  console.log(`[BuybackService] Distributing ${tokenAmount} tokens for buyback ${buybackId}`);

  // Call LootGO Distribution API (stubbed)
  const result = await lootgoDistribution.distributeTokens({
    tokenAddress: tokenMint,
    amount: tokenAmount,
    campaignMeta: {
      projectName: project.project_name || 'Unknown Project',
      projectLogo: project.project_logo,
      projectDescription: project.project_description,
    },
    geoConfig: project.geo_config as { targeting: 'global' | 'regional'; regions?: string[] } || {
      targeting: 'global',
    },
    expiryHours: 72,
  });

  // Record distribution in DB
  if (result.boxesCreated > 0) {
    const { error } = await supabase
      .from('distributions')
      .insert({
        buyback_id: buybackId,
        lootgo_campaign_id: result.campaignId,
        boxes_created: result.boxesCreated,
        tokens_distributed: tokenAmount,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error(`[BuybackService] Failed to record distribution: ${error.message}`);
      // Don't throw — buyback succeeded, distribution is best-effort
    }
  } else {
    console.log(`[BuybackService] Skipping distribution: below minimum box value threshold`);
  }

  return {
    campaignId: result.campaignId,
    boxesCreated: result.boxesCreated,
  };
}
