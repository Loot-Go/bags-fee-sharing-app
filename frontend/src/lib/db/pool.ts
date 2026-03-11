import { Pool } from 'pg';

// Singleton pool for serverless (reuse across warm invocations)
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL!,
      ssl: process.env.DATABASE_URL?.includes('rds.amazonaws.com')
        ? { rejectUnauthorized: false }
        : false,
      max: 5, // keep low for serverless
    });
  }
  return pool;
}
