# LootGO: Fee Hunt 🎁

> Turn Bags trading fees into GPS loot boxes scattered around the world.

**Platform:** [Bags Fee Sharing App Store](https://docs.bags.fm/)  
**Chain:** Solana Devnet → Mainnet  
**Status:** MVP / Hackathon Submission

---

## How It Works

```
Trading Fees
     │
     └─► LootGO (co-creator, e.g. 20%)
              │
              ├─► 5% → LootGO platform fee
              └─► 15% → Buyback token → GPS loot boxes 🎁
```

1. Projects set LootGO as a Bags co-creator (10-50% of trading fees)
2. Fees accumulate, auto-claimed hourly (or when > $10)
3. Claims queue for manual approval (safety gate)
4. On approval: Bags API executes token buyback
5. Tokens scattered as GPS loot boxes via LootGO Distribution API

---

## Project Structure

```
lootgo-fee-hunt/
├── backend/          # Express API + cron service
├── frontend/         # Next.js 14 dashboard
├── supabase/         # SQL migration
└── README.md
```

---

## Quick Start

### 1. Database (Supabase)

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor and run `supabase/migration.sql`
3. Note your project URL and service role key

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in your .env values (see below)
npm install
npm run dev
```

Backend runs at `http://localhost:3001`

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev
```

Dashboard at `http://localhost:3000`

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Required |
|---|---|---|
| `PORT` | Server port (default: 3001) | No |
| `SOLANA_RPC_URL` | Solana RPC URL (use devnet) | Yes |
| `PLATFORM_WALLET_ADDRESS` | LootGO platform wallet pubkey | Yes |
| `PLATFORM_WALLET_PRIVATE_KEY` | Platform wallet private key (base58) | Yes |
| `BAGS_API_KEY` | Bags API key from dev.bags.fm | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `PLATFORM_FEE_PCT` | LootGO's cut of its share (default: 0.25 = 25%) | No |
| `PLAYER_FEE_PCT` | Player loot share (default: 0.75 = 75%) | No |
| `AUTO_CLAIM_THRESHOLD_SOL` | Min SOL to trigger auto-claim (default: 0.1) | No |
| `CLAIM_CRON_SCHEDULE` | Cron schedule (default: `0 * * * *` = hourly) | No |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL (default: http://localhost:3001) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana RPC (default: devnet) |

---

## API Reference

### Projects

```
POST /api/projects
  Body: { tokenAddress, creatorWallet, feeSharePct, projectName?, projectLogo?, projectDescription? }
  
GET  /api/projects
GET  /api/projects/:id
```

### Claims

```
GET  /api/claims?status=pending&limit=50&offset=0
GET  /api/claims/:id
POST /api/claims/:id/approve   → triggers buyback + distribution
POST /api/claims/:id/reject    Body: { reason? }
GET  /api/claims/export/csv
POST /api/claims/trigger       Body: { tokenAddress? }  (manual claim trigger)
```

### Dashboard

```
GET  /api/dashboard/stats
```

---

## Bags API Integration

All Bags API calls use:
- **Base URL:** `https://public-api-v2.bags.fm/api/v1`  
- **Auth:** `x-api-key` header

Key endpoints used:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/claim-transactions-v3/:tokenMint` | Get claim transactions (v3) |
| GET | `/claimable-positions?wallet=<addr>` | Check unclaimed fees |
| GET | `/trade-quote` | Get buyback quote |
| POST | `/swap` | Execute buyback (Bags native, not Jupiter) |
| POST | `/fee-share-admin-update-config` | Set LootGO as co-creator |
| GET | `/token-claim-stats/:tokenMint` | Claim statistics |
| GET | `/partner-stats?partnerKey=<key>` | Partner fee stats |

---

## LootGO Distribution API (STUB)

The distribution layer is stubbed in `backend/src/services/lootgoDistribution.ts`.

**Interface:**
```typescript
distributeTokens({
  tokenAddress: string,
  amount: number,
  campaignMeta: { projectName, projectLogo?, projectDescription? },
  geoConfig?: { targeting: 'global' | 'regional', regions?: string[] },
  boxCount?: number,
  expiryHours?: number,
}) → Promise<{ campaignId: string, boxesCreated: number }>
```

Replace the stub implementation when the real API is confirmed. The interface is stable.

---

## Deployment

### Backend → Railway

1. Push to GitHub
2. Connect Railway to repo, set root to `/backend`
3. Set all env vars in Railway dashboard
4. Deploy

### Frontend → Vercel

1. Connect Vercel to repo, set root to `/frontend`
2. Set `NEXT_PUBLIC_API_URL` to your Railway backend URL
3. Deploy

---

## Notes for Hackathon Judges

- **Devnet only** — all transactions are simulated (no real SOL spent)
- **Manual approval gate** is intentional — prevents auto-buyback on bad data
- **Distribution API stub** clearly marked with TODOs for real integration
- **Fee split:** 5% LootGO platform + 15% player loot = 20% LootGO co-creator (configurable 10-50%)
- Clean, well-commented TypeScript throughout
