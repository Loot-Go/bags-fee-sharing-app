import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db/pool';

export async function GET() {
  const pool = getPool();
  try {
    const [claimsRes, buybacksRes, distributionsRes, pendingRes] = await Promise.all([
      pool.query(`SELECT sol_amount, platform_fee, player_amount FROM claims WHERE status = 'approved'`),
      pool.query(`SELECT token_amount, sol_spent FROM buybacks`),
      pool.query(`SELECT boxes_created, tokens_distributed FROM distributions`),
      pool.query(`SELECT COUNT(*) FROM claims WHERE status = 'pending'`),
    ]);

    const claims = claimsRes.rows;
    const buybacks = buybacksRes.rows;
    const distributions = distributionsRes.rows;

    const totalSolClaimed = claims.reduce((s: number, c: any) => s + parseFloat(c.sol_amount), 0);
    const solPriceUsd = 150;

    return NextResponse.json({
      totalSolClaimed,
      totalSolClaimedUsd: totalSolClaimed * solPriceUsd,
      totalPlatformFee: claims.reduce((s: number, c: any) => s + parseFloat(c.platform_fee), 0),
      totalPlayerAmount: claims.reduce((s: number, c: any) => s + parseFloat(c.player_amount), 0),
      totalBuybackVolSol: buybacks.reduce((s: number, b: any) => s + parseFloat(b.sol_spent), 0),
      totalTokensBought: buybacks.reduce((s: number, b: any) => s + parseFloat(b.token_amount), 0),
      totalBoxesCreated: distributions.reduce((s: number, d: any) => s + (d.boxes_created || 0), 0),
      totalTokensDistributed: distributions.reduce((s: number, d: any) => s + parseFloat(d.tokens_distributed || 0), 0),
      pendingApprovals: parseInt(pendingRes.rows[0].count),
      uniquePlayersReached: null,
      activeBoxesCount: null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
