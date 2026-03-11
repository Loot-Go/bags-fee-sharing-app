import { NextRequest, NextResponse } from 'next/server';
import { runClaimCycle } from '@/lib/services/feeClaimService';

/**
 * Vercel Cron Job endpoint — called hourly by Vercel scheduler
 * Configured in vercel.json: { "crons": [{ "path": "/api/cron/claim", "schedule": "0 * * * *" }] }
 *
 * Protected by CRON_SECRET to prevent unauthorized calls.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron] Starting claim cycle via Vercel cron...');
    await runClaimCycle();
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error('[Cron] Claim cycle failed:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
