/**
 * Fee Claim Service
 * 
 * Handles the core fee claiming loop:
 * 1. Check claimable positions for all registered projects
 * 2. If balance > threshold, generate and submit claim transactions
 * 3. Record claim in DB with pending status
 * 4. Track consecutive failures and alert if too many
 */

import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { supabase } from '../db/supabase';
import { bagsApi } from './bagsApi';
import { config } from '../config';

// Track consecutive failures per project for alerting
const failureCounters: Map<string, number> = new Map();

// SOL mint address (native SOL wrapped)
const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Run the fee claim cycle for all registered projects.
 * Called by cron job every hour and on-demand when threshold is exceeded.
 */
export async function runClaimCycle(): Promise<void> {
  console.log('[FeeClaimService] Starting claim cycle...');

  // Fetch all registered projects
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*');

  if (error) {
    console.error('[FeeClaimService] Failed to fetch projects:', error);
    return;
  }

  if (!projects || projects.length === 0) {
    console.log('[FeeClaimService] No projects registered. Skipping.');
    return;
  }

  // Process each project
  for (const project of projects) {
    await claimFeesForProject(project).catch(err => {
      console.error(`[FeeClaimService] Uncaught error for project ${project.token_address}:`, err);
    });
  }

  console.log('[FeeClaimService] Claim cycle complete.');
}

/**
 * Claim fees for a single project token.
 * Records the result in the claims table with 'pending' status.
 */
async function claimFeesForProject(project: {
  id: string;
  token_address: string;
  fee_share_pct: number;
}): Promise<void> {
  const { id: projectId, token_address: tokenMint, fee_share_pct: feeSharePct } = project;

  try {
    console.log(`[FeeClaimService] Checking claimable fees for token: ${tokenMint}`);

    // 1. Get claim transactions from Bags API
    //    Endpoint: GET /claim-transactions-v3/<tokenMint>
    const claimData = await bagsApi.getClaimTransactions(tokenMint);

    if (!claimData.transactions || claimData.transactions.length === 0) {
      console.log(`[FeeClaimService] No claimable fees for ${tokenMint}`);
      return;
    }

    // 2. Check if amount exceeds threshold
    const estimatedSol = claimData.estimatedSol || 0;
    if (estimatedSol < config.autoClaimThresholdSol) {
      console.log(`[FeeClaimService] ${tokenMint}: ${estimatedSol} SOL below threshold ${config.autoClaimThresholdSol} SOL`);
      return;
    }

    console.log(`[FeeClaimService] ${tokenMint}: Claiming ~${estimatedSol} SOL`);

    // 3. Submit claim transactions to Solana Devnet
    //    NOTE: In production, these transactions need to be signed by the LootGO platform wallet
    //    For Devnet testing, we simulate submission
    const connection = new Connection(config.solanaRpcUrl, 'confirmed');
    let txHash = '';

    // TODO: In production, sign and submit each transaction with platform wallet
    // For now (Devnet), we simulate:
    //   const wallet = Keypair.fromSecretKey(bs58.decode(config.platformWalletPrivateKey));
    //   for (const txData of claimData.transactions) {
    //     const tx = Transaction.from(Buffer.from(txData.transaction, 'base64'));
    //     txHash = await sendAndConfirmTransaction(connection, tx, [wallet]);
    //   }
    
    // DEVNET SIMULATION — record simulated tx hash
    txHash = `DEVNET_SIM_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    console.log(`[FeeClaimService] [DEVNET] Simulated tx: ${txHash}`);

    // 4. Calculate fee split
    // LootGO receives feeSharePct% of total trading fees
    // Of LootGO's share: 25% = platform fee, 75% = player loot
    // platformFeePct and playerFeePct are fractions of LootGO's cut
    const platformFee = estimatedSol * config.platformFeePct;
    const playerAmount = estimatedSol * config.playerFeePct;

    // 5. Record claim in DB as 'pending' (requires manual approval before buyback)
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .insert({
        project_id: projectId,
        sol_amount: estimatedSol,
        platform_fee: platformFee,
        player_amount: playerAmount,
        status: 'pending',
        tx_hash: txHash,
        claimed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (claimError) {
      throw new Error(`Failed to save claim: ${claimError.message}`);
    }

    console.log(`[FeeClaimService] ✅ Claim recorded: ${claim.id} (${estimatedSol} SOL, pending approval)`);

    // Reset failure counter on success
    failureCounters.set(tokenMint, 0);

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[FeeClaimService] ❌ Failed for ${tokenMint}: ${errMsg}`);

    // Increment failure counter
    const failures = (failureCounters.get(tokenMint) || 0) + 1;
    failureCounters.set(tokenMint, failures);

    // Alert if consecutive failures exceed threshold
    if (failures >= config.maxConsecutiveFailures) {
      await sendFailureAlert(tokenMint, failures, errMsg);
    }

    // Retry logic: exponential backoff would be implemented at cron level
    // For immediate retry scenarios, the cron will re-attempt on next scheduled run
  }
}

/**
 * Send failure alert when consecutive failures exceed threshold.
 * TODO: Integrate with Slack webhook or email for production alerts.
 */
async function sendFailureAlert(tokenMint: string, failures: number, lastError: string): Promise<void> {
  const message = `🚨 [LootGO Fee Hunt] ALERT: ${failures} consecutive claim failures for token ${tokenMint}. Last error: ${lastError}`;
  console.error('[ALERT]', message);

  // TODO: Send to Slack webhook
  // await axios.post(config.slackWebhookUrl, { text: message });
}

/**
 * Manually trigger a claim check for a specific project.
 * Used by the API endpoint to allow on-demand claims.
 */
export async function claimForToken(tokenMint: string): Promise<void> {
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('token_address', tokenMint)
    .single();

  if (error || !project) {
    throw new Error(`Project not found for token: ${tokenMint}`);
  }

  await claimFeesForProject(project);
}
