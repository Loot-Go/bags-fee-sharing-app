/**
 * Fee Claim Service
 *
 * Handles the core fee claiming loop:
 * 1. Check claimable positions for all registered projects
 * 2. If balance > threshold, generate and submit claim transactions
 * 3. Record claim in DB with pending status for manual approval
 */

import { pool } from '../db/db';
import { bagsApi } from './bagsApi';
import { config } from '../config';

const failureCounters: Map<string, number> = new Map();

export async function runClaimCycle(): Promise<void> {
  console.log('[FeeClaimService] Starting claim cycle...');

  const result = await pool.query(`SELECT * FROM projects`);
  const projects = result.rows;

  if (!projects.length) {
    console.log('[FeeClaimService] No projects registered. Skipping.');
    return;
  }

  for (const project of projects) {
    await claimFeesForProject(project).catch(err => {
      console.error(`[FeeClaimService] Uncaught error for ${project.token_address}:`, err);
    });
  }

  console.log('[FeeClaimService] Claim cycle complete.');
}

async function claimFeesForProject(project: {
  id: string;
  token_address: string;
  fee_share_pct: number;
}): Promise<void> {
  const { id: projectId, token_address: tokenMint } = project;

  try {
    console.log(`[FeeClaimService] Checking claimable fees for: ${tokenMint}`);

    const claimData = await bagsApi.getClaimTransactions(tokenMint);

    if (!claimData.transactions || claimData.transactions.length === 0) {
      console.log(`[FeeClaimService] No claimable fees for ${tokenMint}`);
      return;
    }

    const estimatedSol = claimData.estimatedSol || 0;
    if (estimatedSol < config.autoClaimThresholdSol) {
      console.log(`[FeeClaimService] ${tokenMint}: ${estimatedSol} SOL below threshold`);
      return;
    }

    console.log(`[FeeClaimService] ${tokenMint}: Claiming ~${estimatedSol} SOL`);

    // TODO Production: sign + submit claim transactions with platform wallet
    // For Devnet, simulate:
    const txHash = `DEVNET_SIM_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    console.log(`[FeeClaimService] [DEVNET] Simulated tx: ${txHash}`);

    const platformFee = estimatedSol * config.platformFeePct;
    const playerAmount = estimatedSol * config.playerFeePct;

    await pool.query(
      `INSERT INTO claims (project_id, sol_amount, platform_fee, player_amount, status, tx_hash, claimed_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, NOW())`,
      [projectId, estimatedSol, platformFee, playerAmount, txHash]
    );

    console.log(`[FeeClaimService] ✅ Claim recorded for ${tokenMint} (${estimatedSol} SOL, pending approval)`);
    failureCounters.set(tokenMint, 0);

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[FeeClaimService] ❌ Failed for ${tokenMint}: ${errMsg}`);

    const failures = (failureCounters.get(tokenMint) || 0) + 1;
    failureCounters.set(tokenMint, failures);

    if (failures >= config.maxConsecutiveFailures) {
      console.error(`[ALERT] 🚨 ${failures} consecutive claim failures for ${tokenMint}. Last error: ${errMsg}`);
      // TODO: Send to Slack webhook
    }
  }
}

export async function claimForToken(tokenMint: string): Promise<void> {
  const result = await pool.query(
    `SELECT * FROM projects WHERE token_address = $1`,
    [tokenMint]
  );
  if (result.rows.length === 0) throw new Error(`Project not found for token: ${tokenMint}`);
  await claimFeesForProject(result.rows[0]);
}
