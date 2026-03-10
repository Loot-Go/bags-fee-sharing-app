/**
 * LootGO: Fee Hunt — Backend Entry Point
 * 
 * Express API + Cron Service for fee claiming, buyback, and distribution.
 */

import express from 'express';
import cors from 'cors';
import { config } from './config';
import { startClaimCron } from './cron/claimCron';

// Routes
import projectsRouter from './routes/projects';
import claimsRouter from './routes/claims';
import dashboardRouter from './routes/dashboard';

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/projects', projectsRouter);
app.use('/api/claims', claimsRouter);
app.use('/api/dashboard', dashboardRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    network: config.solanaNetwork,
    timestamp: new Date().toISOString(),
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`🚀 LootGO Fee Hunt backend running on port ${config.port}`);
  console.log(`   Network: ${config.solanaNetwork.toUpperCase()}`);
  console.log(`   Bags API: ${config.bagsApiBaseUrl}`);

  // Start the hourly claim cron
  startClaimCron();
});

export default app;
