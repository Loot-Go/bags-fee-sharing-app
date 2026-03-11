// Server-side config for Next.js API routes
// All process.env vars are server-only (not prefixed with NEXT_PUBLIC_)

export const config = {
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  solanaNetwork: 'devnet' as const,
  platformWallet: process.env.PLATFORM_WALLET_ADDRESS || '',
  platformWalletPrivateKey: process.env.PLATFORM_WALLET_PRIVATE_KEY || '',
  bagsApiKey: process.env.BAGS_API_KEY || '',
  bagsApiBaseUrl: process.env.BAGS_API_BASE_URL || 'https://public-api-v2.bags.fm/api/v1',
  platformFeePct: parseFloat(process.env.PLATFORM_FEE_PCT || '0.25'),
  playerFeePct: parseFloat(process.env.PLAYER_FEE_PCT || '0.75'),
  autoClaimThresholdSol: parseFloat(process.env.AUTO_CLAIM_THRESHOLD_SOL || '0.1'),
  minBoxValueUsd: parseFloat(process.env.MIN_BOX_VALUE_USD || '0.10'),
  maxConsecutiveFailures: parseInt(process.env.MAX_CONSECUTIVE_FAILURES || '3'),
  lootgoDistributionApiUrl: process.env.LOOTGO_DISTRIBUTION_API_URL || 'https://api.lootgo.io/v1',
  lootgoDistributionApiKey: process.env.LOOTGO_DISTRIBUTION_API_KEY || '',
};
