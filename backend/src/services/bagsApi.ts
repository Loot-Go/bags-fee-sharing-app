/**
 * Bags API Service
 * 
 * Base URL: https://public-api-v2.bags.fm/api/v1
 * Auth: x-api-key header
 * Rate limit: 1,000 requests/hour
 * 
 * Key endpoints used:
 *   GET  /claimable-positions?wallet=<address>           — Get claimable fee positions
 *   GET  /claim-transactions-v3/<tokenMint>              — Get claim transactions (v3, simplified)
 *   GET  /partner-stats?partnerKey=<key>                 — Get partner fee stats
 *   POST /fee-share-admin-update-config                  — Update fee share configuration
 *   GET  /trade-quote                                    — Get swap quote
 *   POST /swap                                           — Create swap transaction
 *   GET  /fee-share-admin-list?wallet=<address>          — Get tokens where wallet is fee share admin
 *   GET  /token-claim-stats/<tokenMint>                  — Get claim stats for all claimers
 *   GET  /token-claim-events/<tokenMint>                 — Get claim events for a token
 */

import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

// ─── Response Types ─────────────────────────────────────────────────────────

export interface ClaimablePosition {
  tokenMint: string;
  tokenSymbol?: string;
  unclaimedSol: number;
  unclaimedTokenAmount: number;
  poolAddress: string;
  positionType: 'virtual_pool' | 'damm_v2';
}

export interface ClaimTransaction {
  transaction: string;  // base64 encoded serialized transaction
  signers?: string[];   // additional signers if needed
}

export interface ClaimTransactionsResponse {
  transactions: ClaimTransaction[];
  tokenMint: string;
  estimatedSol: number;
}

export interface FeeShareConfig {
  tokenMint: string;
  admin: string;
  claimers: Array<{
    wallet: string;
    basisPoints: number;  // e.g. 2000 = 20%
  }>;
}

export interface TradeQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  slippage: number;
  routePlan: object[];
}

export interface SwapTransaction {
  transaction: string;  // base64 encoded serialized transaction
  quoteId: string;
}

export interface TokenClaimStats {
  tokenMint: string;
  claimers: Array<{
    wallet: string;
    totalClaimed: number;
    lastClaimedAt?: string;
  }>;
}

export interface PartnerStats {
  partnerKey: string;
  claimedFees: number;
  unclaimedFees: number;
  totalFees: number;
}

// ─── Bags API Client ─────────────────────────────────────────────────────────

class BagsApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.bagsApiBaseUrl,
      headers: {
        'x-api-key': config.bagsApiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Log all requests in dev
    this.client.interceptors.request.use((req) => {
      console.log(`[BagsAPI] ${req.method?.toUpperCase()} ${req.url}`);
      return req;
    });

    // Handle rate limit headers
    this.client.interceptors.response.use(
      (res) => {
        const remaining = res.headers['x-ratelimit-remaining'];
        if (remaining && parseInt(remaining) < 100) {
          console.warn(`[BagsAPI] Rate limit warning: ${remaining} requests remaining`);
        }
        return res;
      },
      (err) => {
        const status = err.response?.status;
        const message = err.response?.data?.message || err.message;
        console.error(`[BagsAPI] Error ${status}: ${message}`);
        throw err;
      }
    );
  }

  /**
   * Get all claimable fee positions for a wallet.
   * Endpoint: GET /claimable-positions?wallet=<address>
   * Returns positions with fee info from virtual pools and DAMM v2.
   */
  async getClaimablePositions(walletAddress: string): Promise<ClaimablePosition[]> {
    const res = await this.client.get('/claimable-positions', {
      params: { wallet: walletAddress },
    });
    return res.data.positions || res.data || [];
  }

  /**
   * Get claim transactions for a token (v3 — simplified, handles all state logic).
   * Endpoint: GET /claim-transactions-v3/<tokenMint>
   * Returns signed-ready transactions to submit to Solana.
   */
  async getClaimTransactions(tokenMint: string): Promise<ClaimTransactionsResponse> {
    const res = await this.client.get(`/claim-transactions-v3/${tokenMint}`);
    return res.data;
  }

  /**
   * Get fee share configuration for a token.
   * Endpoint: GET /fee-share-admin-list?wallet=<address>
   * Returns tokens where the given wallet is fee share admin.
   */
  async getFeeShareAdminList(walletAddress: string): Promise<string[]> {
    const res = await this.client.get('/fee-share-admin-list', {
      params: { wallet: walletAddress },
    });
    return res.data.tokenMints || res.data || [];
  }

  /**
   * Get claim statistics for all fee claimers of a token.
   * Endpoint: GET /token-claim-stats/<tokenMint>
   * Returns total claimed amounts per claimer.
   */
  async getTokenClaimStats(tokenMint: string): Promise<TokenClaimStats> {
    const res = await this.client.get(`/token-claim-stats/${tokenMint}`);
    return res.data;
  }

  /**
   * Get claim events for a token with pagination.
   * Endpoint: GET /token-claim-events/<tokenMint>?mode=offset&limit=50&offset=0
   */
  async getTokenClaimEvents(
    tokenMint: string,
    opts: { limit?: number; offset?: number; fromTimestamp?: number; toTimestamp?: number } = {}
  ) {
    const params: Record<string, unknown> = {
      mode: opts.fromTimestamp ? 'time' : 'offset',
      limit: opts.limit || 50,
      offset: opts.offset || 0,
    };
    if (opts.fromTimestamp) {
      params.from = opts.fromTimestamp;
      params.to = opts.toTimestamp || Math.floor(Date.now() / 1000);
      params.mode = 'time';
    }
    const res = await this.client.get(`/token-claim-events/${tokenMint}`, { params });
    return res.data;
  }

  /**
   * Get a swap/buyback quote.
   * Endpoint: GET /trade-quote?inputMint=<sol>&outputMint=<token>&amount=<lamports>&slippage=<bps>
   */
  async getTradeQuote(
    inputMint: string,
    outputMint: string,
    amountLamports: number,
    slippageBps: number = 100
  ): Promise<TradeQuote> {
    const res = await this.client.get('/trade-quote', {
      params: {
        inputMint,
        outputMint,
        amount: amountLamports,
        slippage: slippageBps,
      },
    });
    return res.data;
  }

  /**
   * Create a swap transaction (buyback SOL → token).
   * Endpoint: POST /swap
   * Uses Bags built-in swap, NOT Jupiter.
   * Transaction must be signed by the paying wallet and submitted to Solana.
   */
  async createSwapTransaction(
    quote: TradeQuote,
    payerWallet: string
  ): Promise<SwapTransaction> {
    const res = await this.client.post('/swap', {
      quote,
      payer: payerWallet,
    });
    return res.data;
  }

  /**
   * Update fee share configuration for a token.
   * Endpoint: POST /fee-share-admin-update-config
   * Allows admin to change fee claimers and their basis point allocations.
   * 
   * Example: Set LootGO as co-creator with 2000 bps (20%)
   */
  async updateFeeShareConfig(
    tokenMint: string,
    adminWallet: string,
    claimers: Array<{ wallet: string; basisPoints: number }>
  ) {
    const res = await this.client.post('/fee-share-admin-update-config', {
      tokenMint,
      admin: adminWallet,
      claimers,
    });
    return res.data;
  }

  /**
   * Get partner fee stats (for LootGO's partner key).
   * Endpoint: GET /partner-stats?partnerKey=<key>
   */
  async getPartnerStats(partnerKey: string): Promise<PartnerStats> {
    const res = await this.client.get('/partner-stats', {
      params: { partnerKey },
    });
    return res.data;
  }

  /**
   * Create a fee share configuration for a new token launch.
   * Endpoint: POST /fee-share-configuration
   * Creates the initial fee sharing setup.
   */
  async createFeeShareConfig(
    tokenMint: string,
    adminWallet: string,
    claimers: Array<{ wallet: string; basisPoints: number }>
  ) {
    const res = await this.client.post('/fee-share-configuration', {
      tokenMint,
      admin: adminWallet,
      claimers,
    });
    return res.data;
  }
}

export const bagsApi = new BagsApiService();
