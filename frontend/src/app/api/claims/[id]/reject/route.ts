import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/pool';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pool = getPool();
  const { reason } = await req.json().catch(() => ({}));

  try {
    const result = await pool.query(
      `UPDATE claims SET status = 'rejected', rejected_at = NOW(), rejection_reason = $2
       WHERE id = $1 AND status = 'pending' RETURNING *`,
      [params.id, reason || 'Rejected by operator']
    );
    if (result.rowCount === 0) return NextResponse.json({ error: 'Claim not found or not pending' }, { status: 400 });
    return NextResponse.json({ success: true, claim: result.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
