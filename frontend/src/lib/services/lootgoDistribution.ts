/**
 * LootGO Distribution API — STUB / MOCK IMPLEMENTATION
 * 
 * TODO: Replace this stub with the real LootGO Distribution API when confirmed.
 * 
 * Expected interface:
 *   distributeTokens(params) → { campaignId, boxesCreated }
 * 
 * This stub:
 *   - Validates input
 *   - Calculates expected box count based on token amount
 *   - Returns a mock campaignId and boxesCreated
 *   - Logs what WOULD be sent to the real API
 * 
 * When real API is available, replace the implementation of distributeTokens()
 * but keep the same interface signature.
 */

import { config } from '../config';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CampaignMeta {
  projectName: string;
  projectLogo?: string;
  projectDescription?: string;
  tokenSymbol?: string;
}

export interface GeoConfig {
  targeting: 'global' | 'regional';
  regions?: string[];           // ISO country codes, e.g. ['US', 'JP', 'SG']
  excludeRegions?: string[];
}

export interface DistributeTokensParams {
  tokenAddress: string;          // SPL token mint address
  amount: number;                // Token amount to distribute
  campaignMeta: CampaignMeta;
  geoConfig?: GeoConfig;
  boxCount?: number;             // Number of loot boxes to create
  expiryHours?: number;          // Box expiry (default: 72h)
  minBoxValueUsd?: number;       // Skip if per-box value below this (default: $0.10)
}

export interface DistributeTokensResult {
  campaignId: string;
  boxesCreated: number;
  tokensPerBox: number;
  expiresAt: string;
  // TODO: additional fields from real API (e.g. map bounds, distribution pattern)
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function generateMockCampaignId(): string {
  // TODO: real API will return this
  return `LOOTGO_MOCK_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function calculateBoxCount(amount: number, tokenPriceUsd: number, minBoxValueUsd: number): number {
  if (tokenPriceUsd <= 0) return 0;
  const totalValueUsd = amount * tokenPriceUsd;
  if (totalValueUsd < minBoxValueUsd) return 0;  // Below minimum, roll into next batch
  return Math.floor(totalValueUsd / minBoxValueUsd);
}

// ─── Distribution Service ────────────────────────────────────────────────────

class LootGODistributionService {
  // TODO: Replace with real API base URL when confirmed
  private readonly API_BASE_URL = process.env.LOOTGO_DISTRIBUTION_API_URL || 'https://api.lootgo.io/v1';
  private readonly API_KEY = process.env.LOOTGO_DISTRIBUTION_API_KEY || '';

  /**
   * Distribute tokens as GPS loot boxes.
   * 
   * TODO: Replace stub implementation with real API call:
   *   POST ${API_BASE_URL}/campaigns
   *   Headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' }
   *   Body: { tokenAddress, amount, campaignMeta, geoConfig, boxCount, expiryHours }
   *   Response: { campaignId, boxesCreated }
   */
  async distributeTokens(params: DistributeTokensParams): Promise<DistributeTokensResult> {
    const {
      tokenAddress,
      amount,
      campaignMeta,
      geoConfig = { targeting: 'global' },
      boxCount,
      expiryHours = 72,
      minBoxValueUsd = config.minBoxValueUsd,
    } = params;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!tokenAddress) throw new Error('tokenAddress is required');
    if (!amount || amount <= 0) throw new Error('amount must be positive');
    if (!campaignMeta.projectName) throw new Error('projectName is required');

    // ── Log what would be sent to real API ──────────────────────────────────
    console.log('[LootGO Distribution API - STUB] Would send:', {
      endpoint: `POST ${this.API_BASE_URL}/campaigns`,
      payload: {
        tokenAddress,
        amount,
        campaignMeta,
        geoConfig,
        boxCount,
        expiryHours,
      },
    });

    // ── Mock: estimate token price (TODO: use real price oracle) ───────────
    // TODO: integrate Coingecko or Jupiter price API to get real token price
    const mockTokenPriceUsd = 0.01;  // placeholder — $0.01 per token
    const totalValueUsd = amount * mockTokenPriceUsd;

    // Check minimum box value threshold
    if (totalValueUsd < minBoxValueUsd) {
      console.log(`[LootGO Distribution API - STUB] Skipping: total value $${totalValueUsd.toFixed(4)} below minimum $${minBoxValueUsd}`);
      return {
        campaignId: 'SKIPPED_BELOW_MINIMUM',
        boxesCreated: 0,
        tokensPerBox: 0,
        expiresAt: new Date(Date.now() + expiryHours * 3600 * 1000).toISOString(),
      };
    }

    // Calculate box count
    const calculatedBoxCount = boxCount || calculateBoxCount(amount, mockTokenPriceUsd, minBoxValueUsd);
    const tokensPerBox = calculatedBoxCount > 0 ? amount / calculatedBoxCount : 0;

    // ── Mock response ────────────────────────────────────────────────────────
    // TODO: Replace with actual API response
    const mockResult: DistributeTokensResult = {
      campaignId: generateMockCampaignId(),
      boxesCreated: calculatedBoxCount,
      tokensPerBox,
      expiresAt: new Date(Date.now() + expiryHours * 3600 * 1000).toISOString(),
    };

    console.log('[LootGO Distribution API - STUB] Mock response:', mockResult);

    // ── Simulate network delay ────────────────────────────────────────────
    await new Promise(resolve => setTimeout(resolve, 200));

    return mockResult;
  }

  /**
   * Get campaign status by ID.
   * TODO: Implement when real API is available.
   *   GET ${API_BASE_URL}/campaigns/:campaignId
   */
  async getCampaignStatus(campaignId: string): Promise<{ status: string; boxesRemaining: number }> {
    // TODO: real API call
    console.log(`[LootGO Distribution API - STUB] getCampaignStatus: ${campaignId}`);
    return {
      status: 'active',
      boxesRemaining: 0,  // mock
    };
  }
}

export const lootgoDistribution = new LootGODistributionService();
