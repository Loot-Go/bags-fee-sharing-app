import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  
  // Solana — Devnet only
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  solanaNetwork: 'devnet' as const,
  
  // LootGO platform wallet (receives 5% platform fee)
  platformWallet: process.env.PLATFORM_WALLET_ADDRESS || '',
  platformWalletPrivateKey: process.env.PLATFORM_WALLET_PRIVATE_KEY || '',
  
  // Bags API
  // Base URL: https://public-api-v2.bags.fm/api/v1
  // Auth: x-api-key header
  bagsApiKey: process.env.BAGS_API_KEY || '',
  bagsApiBaseUrl: process.env.BAGS_API_BASE_URL || 'https://public-api-v2.bags.fm/api/v1',
  
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
  // Fee split percentages (of LootGO's co-creator share)
  // e.g. if LootGO has 20% co-creator fee:
  //   platformFeePct: 25% of LootGO's share = 5% of total
  //   playerFeePct:  75% of LootGO's share = 15% of total
  platformFeePct: parseFloat(process.env.PLATFORM_FEE_PCT || '0.25'),  // 25% of LootGO's cut
  playerFeePct: parseFloat(process.env.PLAYER_FEE_PCT || '0.75'),      // 75% of LootGO's cut
  
  // Auto-claim trigger: claim when unclaimed balance exceeds this SOL amount (~$10)
  autoClaimThresholdSol: parseFloat(process.env.AUTO_CLAIM_THRESHOLD_SOL || '0.1'),
  
  // Loot box minimum value in USD
  minBoxValueUsd: parseFloat(process.env.MIN_BOX_VALUE_USD || '0.10'),
  
  // Cron schedule: every hour
  claimCronSchedule: process.env.CLAIM_CRON_SCHEDULE || '0 * * * *',
  
  // Max consecutive failures before alerting
  maxConsecutiveFailures: parseInt(process.env.MAX_CONSECUTIVE_FAILURES || '3'),
  
  // CORS allowed origins
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
};
