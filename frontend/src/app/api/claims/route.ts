import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/pool';
import { runClaimCycle, claimForToken } from '@/lib/services/feeClaimService';

export async function GET(req: NextRequest) {
  const pool = getPool();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const project_id = searchParams.get('project_id');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const conditions: string[] = [];
  const params: any[] = [];
  let i = 1;

  if (status) { conditions.push(`c.status = $${i++}`); params.push(status); }
  if (project_id) { conditions.push(`c.project_id = $${i++}`); params.push(project_id); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);

  try {
    const result = await pool.query(
      `SELECT c.*,
         json_build_object('token_address', p.token_address, 'project_name', p.project_name) AS projects,
         (SELECT json_agg(b) FROM buybacks b WHERE b.claim_id = c.id) AS buybacks
       FROM claims c LEFT JOIN projects p ON p.id = c.project_id
       ${where} ORDER BY c.claimed_at DESC LIMIT $${i} OFFSET $${i+1}`,
      params
    );
    const countResult = await pool.query(`SELECT COUNT(*) FROM claims c ${where}`, params.slice(0, -2));
    return NextResponse.json({ claims: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // POST /api/claims → manual trigger
  const { tokenAddress } = await req.json().catch(() => ({}));
  try {
    if (tokenAddress) {
      await claimForToken(tokenAddress);
      return NextResponse.json({ success: true, message: `Claim triggered for ${tokenAddress}` });
    } else {
      await runClaimCycle();
      return NextResponse.json({ success: true, message: 'Full claim cycle triggered' });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
