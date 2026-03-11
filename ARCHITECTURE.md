# LootGO Fee Hunt — Architecture

## Overview
Bags hackathon app: auto-claim Solana trading fees → buyback tokens → distribute as GPS loot boxes.

## Infrastructure (Vercel + RDS only — no EC2)

```
Vercel
  ├── Frontend (Next.js)          → pages: /, /setup, /queue, /history
  ├── API Routes                  → backend logic as serverless functions
  │     ├── GET  /api/projects
  │     ├── POST /api/projects
  │     ├── GET  /api/claims
  │     ├── POST /api/claims/:id/approve
  │     ├── POST /api/claims/:id/reject
  │     ├── GET  /api/dashboard/stats
  │     └── GET  /api/cron/claim     ← Vercel Cron calls this hourly
  └── Cron (vercel.json)          → 0 * * * * → /api/cron/claim

AWS RDS (PostgreSQL)
  └── Tables: projects, claims, buybacks, distributions
  └── View: project_stats

External APIs
  ├── Bags API (https://public-api-v2.bags.fm/api/v1)
  │     ├── GET  /claimable-positions   ← check unclaimed fees
  │     ├── POST /claim-transactions-v3 ← build claim tx
  │     └── POST /swap                 ← buyback tx
  └── LootGO Distribution API (STUB — pending @Jyam)
        └── POST /campaigns            ← create loot box campaign
```

## Code Layout (all in /frontend)

```
frontend/
  src/
    app/
      api/          ← Next.js API routes (backend)
      page.tsx      ← Dashboard
      setup/        ← Register token project
      queue/        ← Approval queue
      history/      ← Claim history
    lib/
      db/pool.ts    ← pg Pool singleton (AWS RDS)
      config.ts     ← Server-side env vars
      services/
        feeClaimService.ts    ← Claim cycle logic
        buybackService.ts     ← Bags API buyback
        bagsApi.ts            ← Bags API client
        lootgoDistribution.ts ← STUB — wire up when @Jyam confirms API
```

## Data Flow

```
[Vercel Cron - hourly]
  → feeClaimService.runClaimCycle()
  → Bags API: check claimable fees per project
  → If > threshold: submit claim tx (sign with PLATFORM_WALLET_PRIVATE_KEY)
  → Save claim as "pending" in DB

[Manual Approval - /queue page]
  → Yuki approves claim
  → buybackService.executeBuyback()
  → Bags API: get quote → submit swap tx
  → lootgoDistribution.distributeTokens()  ← STUB
  → Save buyback + distribution in DB
```

## Environment Variables

| Variable | Description | Status |
|----------|-------------|--------|
| `DATABASE_URL` | AWS RDS connection string | ✅ Set in Vercel |
| `SOLANA_RPC_URL` | Solana RPC (devnet/mainnet) | ✅ Set in Vercel |
| `PLATFORM_WALLET_ADDRESS` | Platform wallet pubkey | ⏳ Needed |
| `PLATFORM_WALLET_PRIVATE_KEY` | Platform wallet private key (base58) | ⏳ Needed |
| `BAGS_API_KEY` | Bags API key | ⏳ Get from dev.bags.fm |
| `BAGS_API_BASE_URL` | `https://public-api-v2.bags.fm/api/v1` | ✅ |
| `PLATFORM_FEE_PCT` | Platform fee split (0.25 = 25%) | ✅ |
| `PLAYER_FEE_PCT` | Player buyback split (0.75 = 75%) | ✅ |
| `AUTO_CLAIM_THRESHOLD_SOL` | Min SOL before auto-claim (0.1) | ✅ |
| `CRON_SECRET` | Vercel cron auth secret | ✅ Set in Vercel |
| `LOOTGO_DISTRIBUTION_API_KEY` | LootGO distribution API key | ⏳ Waiting on @Jyam |

## What's Stubbed (TODO before mainnet)

1. **Real tx signing** — `feeClaimService.ts` + `buybackService.ts` use placeholder tx hashes. Replace with real `@solana/web3.js` signing once `PLATFORM_WALLET_PRIVATE_KEY` is set.
2. **LootGO Distribution** — `lootgoDistribution.ts` is a stub. Wire up real API once @Jyam confirms endpoint + auth format.

## DB Migration

```bash
psql $DATABASE_URL -f supabase/migration.sql
```
