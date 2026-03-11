import { Pool } from 'pg';
import { config } from '../config';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('rds.amazonaws.com')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err);
});

// Type definitions matching our DB schema
export interface Project {
  id: string;
  token_address: string;
  creator_wallet: string;
  fee_share_pct: number;
  project_name?: string;
  project_logo?: string;
  project_description?: string;
  geo_config: GeoConfig;
  created_at: string;
}

export interface GeoConfig {
  targeting: 'global' | 'regional';
  regions?: string[];
  exclude_regions?: string[];
  box_count?: number;
  expiry_hours?: number;
}

export interface Claim {
  id: string;
  project_id: string;
  sol_amount: number;
  platform_fee: number;
  player_amount: number;
  status: 'pending' | 'approved' | 'rejected';
  tx_hash?: string;
  bags_claim_event_id?: string;
  claimed_at: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
}

export interface Buyback {
  id: string;
  claim_id: string;
  token_amount: number;
  sol_spent: number;
  bags_tx_hash?: string;
  executed_at: string;
}

export interface Distribution {
  id: string;
  buyback_id: string;
  lootgo_campaign_id?: string;
  boxes_created?: number;
  tokens_distributed?: number;
  created_at: string;
}
