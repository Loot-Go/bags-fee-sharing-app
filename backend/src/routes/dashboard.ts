/**
 * Dashboard Router
 * GET /api/dashboard/stats — Aggregate stats (total fees, buyback vol, distributions)
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/db';

const router = Router();

router.get('/stats', async (_req: Request, res: Response) => {
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

    const totalSolClaimed = claims.reduce((s, c) => s + parseFloat(c.sol_amount), 0);
    const totalPlatformFee = claims.reduce((s, c) => s + parseFloat(c.platform_fee), 0);
    const totalPlayerAmount = claims.reduce((s, c) => s + parseFloat(c.player_amount), 0);
    const totalBuybackVolSol = buybacks.reduce((s, b) => s + parseFloat(b.sol_spent), 0);
    const totalTokensBought = buybacks.reduce((s, b) => s + parseFloat(b.token_amount), 0);
    const totalBoxesCreated = distributions.reduce((s, d) => s + (d.boxes_created || 0), 0);
    const totalTokensDistributed = distributions.reduce((s, d) => s + parseFloat(d.tokens_distributed || 0), 0);

    const solPriceUsd = 150; // placeholder — TODO: integrate price oracle
    return res.json({
      totalSolClaimed,
      totalSolClaimedUsd: totalSolClaimed * solPriceUsd,
      totalPlatformFee,
      totalPlayerAmount,
      totalBuybackVolSol,
      totalTokensBought,
      totalBoxesCreated,
      totalTokensDistributed,
      pendingApprovals: parseInt(pendingRes.rows[0].count),
      uniquePlayersReached: null,  // TODO: from LootGO Distribution API
      activeBoxesCount: null,       // TODO: from LootGO Distribution API
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
