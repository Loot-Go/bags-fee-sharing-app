-- LootGO: Fee Hunt — Supabase Migration
-- Run this in your Supabase SQL editor to set up the schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Projects: each registered token with LootGO as co-creator
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL UNIQUE,
  creator_wallet TEXT NOT NULL,
  fee_share_pct INTEGER NOT NULL DEFAULT 20,  -- % of total fees LootGO receives as co-creator
  project_name TEXT,
  project_logo TEXT,
  project_description TEXT,
  geo_config JSONB DEFAULT '{"targeting": "global"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Claims: fee claim events from Bags SDK
-- Fee split: platform_fee = 5% of total, player_amount = 15% of total (leaving 80% to creator)
-- Wait — spec says LootGO is co-creator at e.g. 20%. Of that 20%:
--   5% platform fee (LootGO keeps)
--   15% → buyback → loot boxes
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  sol_amount NUMERIC(18,9) NOT NULL,       -- total SOL received by LootGO as co-creator
  platform_fee NUMERIC(18,9) NOT NULL,     -- 5% of total trading fees (LootGO platform cut)
  player_amount NUMERIC(18,9) NOT NULL,    -- 15% of total trading fees (goes to buyback → loot)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  tx_hash TEXT,                            -- Bags claim transaction hash
  bags_claim_event_id TEXT,               -- Bags internal event ID for deduplication
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT
);

-- Buybacks: token purchases executed after claim approval
CREATE TABLE IF NOT EXISTS buybacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
  token_amount NUMERIC(18,9) NOT NULL,   -- tokens received
  sol_spent NUMERIC(18,9) NOT NULL,      -- SOL spent on buyback
  bags_tx_hash TEXT,                     -- Bags swap transaction hash
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Distributions: GPS loot box campaigns created after buyback
CREATE TABLE IF NOT EXISTS distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyback_id UUID REFERENCES buybacks(id) ON DELETE CASCADE,
  lootgo_campaign_id TEXT,              -- TODO: from LootGO Distribution API
  boxes_created INTEGER,
  tokens_distributed NUMERIC(18,9),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_claims_project_id ON claims(project_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_claimed_at ON claims(claimed_at DESC);
CREATE INDEX IF NOT EXISTS idx_buybacks_claim_id ON buybacks(claim_id);
CREATE INDEX IF NOT EXISTS idx_distributions_buyback_id ON distributions(buyback_id);

-- Dashboard view: aggregate stats per project
CREATE OR REPLACE VIEW project_stats AS
SELECT
  p.id AS project_id,
  p.token_address,
  p.project_name,
  p.fee_share_pct,
  COUNT(DISTINCT c.id) AS total_claims,
  COALESCE(SUM(c.sol_amount) FILTER (WHERE c.status = 'approved'), 0) AS total_sol_claimed,
  COALESCE(SUM(c.platform_fee) FILTER (WHERE c.status = 'approved'), 0) AS total_platform_fee,
  COALESCE(SUM(c.player_amount) FILTER (WHERE c.status = 'approved'), 0) AS total_player_amount,
  COALESCE(SUM(b.token_amount), 0) AS total_tokens_bought,
  COALESCE(SUM(d.boxes_created), 0) AS total_boxes_created,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'pending') AS pending_claims
FROM projects p
LEFT JOIN claims c ON c.project_id = p.id
LEFT JOIN buybacks b ON b.claim_id = c.id
LEFT JOIN distributions d ON d.buyback_id = b.id
GROUP BY p.id, p.token_address, p.project_name, p.fee_share_pct;
