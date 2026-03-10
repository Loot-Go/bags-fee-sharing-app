/**
 * Dashboard Router
 * GET /api/dashboard/stats        — Aggregate stats (total fees, buyback vol, distributions)
 * GET /api/dashboard/active-boxes — Count of active loot boxes across all campaigns
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../db/supabase';

const router = Router();

// GET /api/dashboard/stats — Platform-wide aggregate stats
router.get('/stats', async (_req: Request, res: Response) => {
  // Fetch aggregate data
  const [claimsRes, buybacksRes, distributionsRes] = await Promise.all([
    supabase
      .from('claims')
      .select('sol_amount, platform_fee, player_amount, status')
      .eq('status', 'approved'),
    supabase
      .from('buybacks')
      .select('token_amount, sol_spent'),
    supabase
      .from('distributions')
      .select('boxes_created, tokens_distributed, lootgo_campaign_id'),
  ]);

  const claims = claimsRes.data || [];
  const buybacks = buybacksRes.data || [];
  const distributions = distributionsRes.data || [];

  const totalSolClaimed = claims.reduce((sum, c) => sum + (c.sol_amount || 0), 0);
  const totalPlatformFee = claims.reduce((sum, c) => sum + (c.platform_fee || 0), 0);
  const totalPlayerAmount = claims.reduce((sum, c) => sum + (c.player_amount || 0), 0);
  const totalBuybackVolSol = buybacks.reduce((sum, b) => sum + (b.sol_spent || 0), 0);
  const totalTokensBought = buybacks.reduce((sum, b) => sum + (b.token_amount || 0), 0);
  const totalBoxesCreated = distributions.reduce((sum, d) => sum + (d.boxes_created || 0), 0);
  const totalTokensDistributed = distributions.reduce((sum, d) => sum + (d.tokens_distributed || 0), 0);

  // Mock USD conversion (TODO: integrate price oracle)
  const solPriceUsd = 150;  // placeholder
  const totalSolClaimedUsd = totalSolClaimed * solPriceUsd;

  // Pending claims count
  const { count: pendingCount } = await supabase
    .from('claims')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  return res.json({
    totalSolClaimed,
    totalSolClaimedUsd,
    totalPlatformFee,
    totalPlayerAmount,
    totalBuybackVolSol,
    totalTokensBought,
    totalBoxesCreated,
    totalTokensDistributed,
    pendingApprovals: pendingCount || 0,
    // TODO: uniquePlayersReached — requires LootGO Distribution API data
    uniquePlayersReached: null,
    // TODO: activeBoxesCount — requires LootGO Distribution API data
    activeBoxesCount: null,
  });
});

export default router;
