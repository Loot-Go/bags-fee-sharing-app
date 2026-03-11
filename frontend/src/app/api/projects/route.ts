import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/pool';

export async function GET() {
  const pool = getPool();
  try {
    const result = await pool.query(`SELECT * FROM project_stats ORDER BY total_sol_claimed DESC`);
    return NextResponse.json(result.rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const pool = getPool();
  const { tokenAddress, creatorWallet, feeSharePct = 20, projectName, projectLogo, projectDescription, geoConfig } = await req.json();

  if (!tokenAddress || !creatorWallet) {
    return NextResponse.json({ error: 'tokenAddress and creatorWallet are required' }, { status: 400 });
  }
  if (feeSharePct < 10 || feeSharePct > 50) {
    return NextResponse.json({ error: 'feeSharePct must be between 10 and 50' }, { status: 400 });
  }

  try {
    // TODO: call Bags API to set co-creator
    // await bagsApi.updateFeeShareConfig(tokenAddress, creatorWallet, [...])

    const result = await pool.query(
      `INSERT INTO projects (token_address, creator_wallet, fee_share_pct, project_name, project_logo, project_description, geo_config)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tokenAddress, creatorWallet, feeSharePct, projectName, projectLogo, projectDescription,
       JSON.stringify(geoConfig || { targeting: 'global' })]
    );
    return NextResponse.json({ success: true, project: result.rows[0] }, { status: 201 });
  } catch (err: any) {
    if (err.code === '23505') return NextResponse.json({ error: 'Token already registered' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
