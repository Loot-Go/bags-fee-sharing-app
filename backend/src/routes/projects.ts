/**
 * Projects Router
 * POST /api/projects      — Register a new project (token + co-creator config)
 * GET  /api/projects      — List all projects
 * GET  /api/projects/:id  — Get project details + stats
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/db';
import { bagsApi } from '../services/bagsApi';
import { config } from '../config';

const router = Router();

// POST /api/projects — Register token with LootGO as co-creator
router.post('/', async (req: Request, res: Response) => {
  const {
    tokenAddress,
    creatorWallet,
    feeSharePct = 20,
    projectName,
    projectLogo,
    projectDescription,
    geoConfig,
  } = req.body;

  if (!tokenAddress || !creatorWallet) {
    return res.status(400).json({ error: 'tokenAddress and creatorWallet are required' });
  }
  if (feeSharePct < 10 || feeSharePct > 50) {
    return res.status(400).json({ error: 'feeSharePct must be between 10 and 50' });
  }

  try {
    // 1. Update fee share config on Bags to add LootGO as co-creator
    const basisPoints = feeSharePct * 100;
    await bagsApi.updateFeeShareConfig(tokenAddress, creatorWallet, [
      { wallet: config.platformWallet, basisPoints },
    ]);

    // 2. Save project to DB
    const result = await pool.query(
      `INSERT INTO projects (token_address, creator_wallet, fee_share_pct, project_name, project_logo, project_description, geo_config)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tokenAddress, creatorWallet, feeSharePct, projectName, projectLogo, projectDescription,
       JSON.stringify(geoConfig || { targeting: 'global' })]
    );

    return res.status(201).json({ success: true, project: result.rows[0] });

  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Token already registered' });
    }
    console.error('[Projects] POST error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/projects — List all projects with stats
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM project_stats ORDER BY total_sol_claimed DESC`
    );
    return res.json(result.rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id — Get single project stats
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM project_stats WHERE project_id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    return res.json(result.rows[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
