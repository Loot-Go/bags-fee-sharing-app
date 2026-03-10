/**
 * Projects Router
 * POST /api/projects      — Register a new project (token + co-creator config)
 * GET  /api/projects      — List all projects
 * GET  /api/projects/:id  — Get project details + stats
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../db/supabase';
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
    //    Endpoint: POST /fee-share-admin-update-config
    //    LootGO platform wallet gets feeSharePct% of trading fees
    const basisPoints = feeSharePct * 100;  // e.g. 20% = 2000 bps
    
    // TODO: In production, fetch existing claimers first and merge
    // For MVP, we set LootGO as the sole fee claimer at feeSharePct%
    // (remaining fees go to project via Bags default routing)
    await bagsApi.updateFeeShareConfig(tokenAddress, creatorWallet, [
      { wallet: config.platformWallet, basisPoints },
    ]);

    // 2. Save project to DB
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        token_address: tokenAddress,
        creator_wallet: creatorWallet,
        fee_share_pct: feeSharePct,
        project_name: projectName,
        project_logo: projectLogo,
        project_description: projectDescription,
        geo_config: geoConfig || { targeting: 'global' },
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Token already registered' });
      }
      throw error;
    }

    return res.status(201).json({ success: true, project });

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[Projects] POST error:', errMsg);
    return res.status(500).json({ error: errMsg });
  }
});

// GET /api/projects — List all projects with stats
router.get('/', async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('project_stats')
    .select('*')
    .order('total_sol_claimed', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// GET /api/projects/:id — Get single project stats
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('project_stats')
    .select('*')
    .eq('project_id', id)
    .single();

  if (error) return res.status(404).json({ error: 'Project not found' });
  return res.json(data);
});

export default router;
