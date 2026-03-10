/**
 * API client for LootGO Fee Hunt backend
 */
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalSolClaimed: number;
  totalSolClaimedUsd: number;
  totalPlatformFee: number;
  totalPlayerAmount: number;
  totalBuybackVolSol: number;
  totalTokensBought: number;
  totalBoxesCreated: number;
  totalTokensDistributed: number;
  pendingApprovals: number;
  uniquePlayersReached: number | null;
  activeBoxesCount: number | null;
}

export interface Claim {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  sol_amount: number;
  platform_fee: number;
  player_amount: number;
  tx_hash?: string;
  claimed_at: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  projects?: { token_address: string; project_name: string; fee_share_pct: number };
  buybacks?: Array<{ token_amount: number; bags_tx_hash: string; executed_at: string }>;
  distributions?: Array<{ lootgo_campaign_id: string; boxes_created: number }>;
}

export interface Project {
  id: string;
  token_address: string;
  creator_wallet: string;
  fee_share_pct: number;
  project_name?: string;
  project_logo?: string;
  project_description?: string;
  geo_config: object;
  created_at: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const fetchStats = async (): Promise<DashboardStats> => {
  const res = await api.get('/api/dashboard/stats');
  return res.data;
};

// ─── Claims ──────────────────────────────────────────────────────────────────

export const fetchClaims = async (params?: {
  status?: string;
  project_id?: string;
  limit?: number;
  offset?: number;
}): Promise<{ claims: Claim[]; total: number }> => {
  const res = await api.get('/api/claims', { params });
  return res.data;
};

export const approveClaim = async (id: string) => {
  const res = await api.post(`/api/claims/${id}/approve`);
  return res.data;
};

export const rejectClaim = async (id: string, reason?: string) => {
  const res = await api.post(`/api/claims/${id}/reject`, { reason });
  return res.data;
};

export const exportClaimsCSV = () => {
  window.open(`${API_BASE}/api/claims/export/csv`, '_blank');
};

// ─── Projects ────────────────────────────────────────────────────────────────

export const fetchProjects = async (): Promise<Project[]> => {
  const res = await api.get('/api/projects');
  return res.data;
};

export const registerProject = async (data: {
  tokenAddress: string;
  creatorWallet: string;
  feeSharePct: number;
  projectName?: string;
  projectLogo?: string;
  projectDescription?: string;
}) => {
  const res = await api.post('/api/projects', data);
  return res.data;
};
