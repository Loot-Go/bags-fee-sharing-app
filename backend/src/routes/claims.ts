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
import { pool } from '../db/db';
import { executeBuyback } from '../services/buybackService';
import { claimForToken, runClaimCycle } from '../services/feeClaimService';

const router = Router();

// GET /api/claims — List claims with pagination and status filter
router.get('/', async (req: Request, res: Response) => {
  const { status, project_id, limit = '50', offset = '0' } = req.query;

  const conditions: string[] = [];
  const params: any[] = [];
  let i = 1;

  if (status) { conditions.push(`c.status = $${i++}`); params.push(status); }
  if (project_id) { conditions.push(`c.project_id = $${i++}`); params.push(project_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(parseInt(limit as string));
  params.push(parseInt(offset as string));

  try {
    const result = await pool.query(
      `SELECT c.*,
         json_build_object('token_address', p.token_address, 'project_name', p.project_name, 'fee_share_pct', p.fee_share_pct) AS projects,
         (SELECT json_agg(b) FROM buybacks b WHERE b.claim_id = c.id) AS buybacks,
         (SELECT json_agg(d) FROM distributions d JOIN buybacks b2 ON d.buyback_id = b2.id WHERE b2.claim_id = c.id) AS distributions
       FROM claims c
       LEFT JOIN projects p ON p.id = c.project_id
       ${where}
       ORDER BY c.claimed_at DESC
       LIMIT $${i} OFFSET $${i+1}`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM claims c ${where}`,
      params.slice(0, -2)
    );

    return res.json({ claims: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/claims/export/csv — Export all claims as CSV
router.get('/export/csv', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.status, c.sol_amount, c.platform_fee, c.player_amount, c.tx_hash, c.claimed_at,
              p.token_address, p.project_name,
              b.token_amount AS token_amount_bought, b.bags_tx_hash, b.executed_at AS buyback_executed_at,
              d.lootgo_campaign_id, d.boxes_created
       FROM claims c
       LEFT JOIN projects p ON p.id = c.project_id
       LEFT JOIN buybacks b ON b.claim_id = c.id
       LEFT JOIN distributions d ON d.buyback_id = b.id
       ORDER BY c.claimed_at DESC`
    );

    const headers = [
      'claim_id','status','token_address','project_name',
      'sol_amount','platform_fee','player_amount',
      'claim_tx_hash','claimed_at',
      'token_amount_bought','buyback_tx_hash','buyback_executed_at',
      'campaign_id','boxes_created'
    ].join(',');

    const rows = result.rows.map((r: any) => [
      r.id, r.status, r.token_address || '', r.project_name || '',
      r.sol_amount, r.platform_fee, r.player_amount,
      r.tx_hash || '', r.claimed_at,
      r.token_amount_bought || '', r.bags_tx_hash || '', r.buyback_executed_at || '',
      r.lootgo_campaign_id || '', r.boxes_created || '',
    ].map(v => `"${v}"`).join(','));

    const csv = [headers, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="lootgo-claims.csv"');
    return res.send(csv);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/claims/:id — Get single claim
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
         row_to_json(p) AS projects,
         (SELECT json_agg(b) FROM buybacks b WHERE b.claim_id = c.id) AS buybacks,
         (SELECT json_agg(d) FROM distributions d JOIN buybacks b2 ON d.buyback_id = b2.id WHERE b2.claim_id = c.id) AS distributions
       FROM claims c
       LEFT JOIN projects p ON p.id = c.project_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Claim not found' });
    return res.json(result.rows[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/claims/:id/approve — Approve claim and execute buyback
router.post('/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const update = await pool.query(
      `UPDATE claims SET status = 'approved', approved_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [id]
    );

    if (update.rowCount === 0) {
      return res.status(400).json({ error: 'Claim not found or not in pending state' });
    }

    const result = await executeBuyback(id);
    return res.json({
      success: true,
      message: 'Claim approved and buyback executed',
      buybackId: result.buybackId,
      tokenAmount: result.tokenAmount,
      txHash: result.txHash,
      distribution: result.distributionResult,
    });
  } catch (err: any) {
    // Revert approval if buyback fails
    await pool.query(
      `UPDATE claims SET status = 'pending', approved_at = NULL WHERE id = $1`,
      [id]
    );
    return res.status(500).json({ error: `Buyback failed: ${err.message}` });
  }
});

// POST /api/claims/:id/reject — Reject a pending claim
router.post('/:id/reject', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const result = await pool.query(
      `UPDATE claims SET status = 'rejected', rejected_at = NOW(), rejection_reason = $2
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id, reason || 'Rejected by operator']
    );
    if (result.rowCount === 0) return res.status(400).json({ error: 'Claim not found or not pending' });
    return res.json({ success: true, claim: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
