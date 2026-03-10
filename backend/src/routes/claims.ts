/**
 * Claims Router
 * GET  /api/claims                  — List claims (filterable by status)
 * GET  /api/claims/:id              — Get single claim
 * POST /api/claims/:id/approve      — Approve claim → trigger buyback
 * POST /api/claims/:id/reject       — Reject claim
 * GET  /api/claims/export/csv       — Export claims as CSV
 * POST /api/claims/trigger          — Manually trigger claim cycle
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../db/supabase';
import { executeBuyback } from '../services/buybackService';
import { claimForToken, runClaimCycle } from '../services/feeClaimService';

const router = Router();

// GET /api/claims — List claims with pagination and status filter
router.get('/', async (req: Request, res: Response) => {
  const { status, project_id, limit = '50', offset = '0' } = req.query;

  let query = supabase
    .from('claims')
    .select(`
      *,
      projects(token_address, project_name, fee_share_pct),
      buybacks(id, token_amount, sol_spent, bags_tx_hash, executed_at),
      distributions(lootgo_campaign_id, boxes_created, tokens_distributed)
    `)
    .order('claimed_at', { ascending: false })
    .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

  if (status) query = query.eq('status', status);
  if (project_id) query = query.eq('project_id', project_id);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ claims: data, total: count });
});

// GET /api/claims/export/csv — Export all claims as CSV
router.get('/export/csv', async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('claims')
    .select(`
      id, status, sol_amount, platform_fee, player_amount, tx_hash, claimed_at,
      projects(token_address, project_name),
      buybacks(token_amount, bags_tx_hash, executed_at),
      distributions(lootgo_campaign_id, boxes_created)
    `)
    .order('claimed_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Build CSV
  const headers = [
    'claim_id', 'status', 'token_address', 'project_name',
    'sol_amount', 'platform_fee', 'player_amount',
    'claim_tx_hash', 'claimed_at',
    'token_amount_bought', 'buyback_tx_hash', 'buyback_executed_at',
    'campaign_id', 'boxes_created'
  ].join(',');

  const rows = (data || []).map((c: any) => [
    c.id, c.status,
    c.projects?.token_address || '', c.projects?.project_name || '',
    c.sol_amount, c.platform_fee, c.player_amount,
    c.tx_hash || '', c.claimed_at,
    c.buybacks?.[0]?.token_amount || '', c.buybacks?.[0]?.bags_tx_hash || '', c.buybacks?.[0]?.executed_at || '',
    c.distributions?.[0]?.lootgo_campaign_id || '', c.distributions?.[0]?.boxes_created || '',
  ].map(v => `"${v}"`).join(','));

  const csv = [headers, ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="lootgo-claims.csv"');
  return res.send(csv);
});

// GET /api/claims/:id — Get single claim
router.get('/:id', async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('claims')
    .select(`
      *,
      projects(*),
      buybacks(*),
      distributions(*)
    `)
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Claim not found' });
  return res.json(data);
});

// POST /api/claims/:id/approve — Approve claim and execute buyback
router.post('/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Transition claim to approved
  const { error: updateErr } = await supabase
    .from('claims')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending');  // Only approve pending claims

  if (updateErr) {
    return res.status(400).json({ error: updateErr.message });
  }

  // Execute buyback asynchronously
  try {
    const result = await executeBuyback(id);
    return res.json({
      success: true,
      message: 'Claim approved and buyback executed',
      buybackId: result.buybackId,
      tokenAmount: result.tokenAmount,
      txHash: result.txHash,
      distribution: result.distributionResult,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // Revert approval if buyback fails
    await supabase
      .from('claims')
      .update({ status: 'pending', approved_at: null })
      .eq('id', id);
    return res.status(500).json({ error: `Buyback failed: ${errMsg}` });
  }
});

// POST /api/claims/:id/reject — Reject a pending claim
router.post('/:id/reject', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const { data, error } = await supabase
    .from('claims')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejection_reason: reason || 'Rejected by operator',
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ success: true, claim: data });
});

// POST /api/claims/trigger — Manually trigger claim cycle
router.post('/trigger', async (req: Request, res: Response) => {
  const { tokenAddress } = req.body;
  try {
    if (tokenAddress) {
      await claimForToken(tokenAddress);
      return res.json({ success: true, message: `Claim triggered for ${tokenAddress}` });
    } else {
      await runClaimCycle();
      return res.json({ success: true, message: 'Full claim cycle triggered' });
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: errMsg });
  }
});

export default router;
