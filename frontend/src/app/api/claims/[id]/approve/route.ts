import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/pool';
import { executeBuyback } from '@/lib/services/buybackService';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const pool = getPool();
  const { id } = params;

  try {
    const update = await pool.query(
      `UPDATE claims SET status = 'approved', approved_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING id`,
      [id]
    );
    if (update.rowCount === 0) {
      return NextResponse.json({ error: 'Claim not found or not pending' }, { status: 400 });
    }

    const result = await executeBuyback(id);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    await pool.query(`UPDATE claims SET status = 'pending', approved_at = NULL WHERE id = $1`, [id]);
    return NextResponse.json({ error: `Buyback failed: ${err.message}` }, { status: 500 });
  }
}
