/**
 * Cron Job: Fee Claim Scheduler
 * 
 * Schedule: Every hour (configurable via CLAIM_CRON_SCHEDULE env var)
 * Trigger: Also fires when any project's unclaimed balance > $10 threshold
 */

import cron from 'node-cron';
import { runClaimCycle } from '../services/feeClaimService';
import { config } from '../config';

let isRunning = false;

export function startClaimCron(): void {
  console.log(`[ClaimCron] Starting cron with schedule: ${config.claimCronSchedule}`);

  cron.schedule(config.claimCronSchedule, async () => {
    if (isRunning) {
      console.log('[ClaimCron] Previous run still in progress, skipping');
      return;
    }

    isRunning = true;
    console.log(`[ClaimCron] ⏰ Running claim cycle at ${new Date().toISOString()}`);

    try {
      await runClaimCycle();
    } catch (err) {
      console.error('[ClaimCron] Unhandled error in claim cycle:', err);
    } finally {
      isRunning = false;
    }
  });

  console.log('[ClaimCron] ✅ Cron job registered');
}
