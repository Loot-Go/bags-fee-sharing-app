'use client';

import { useEffect, useState } from 'react';
import { fetchClaims, exportClaimsCSV, Claim } from '../../lib/api';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    approved: 'bg-green-500/20 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return (
    <span className={`border text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || ''}`}>
      {status}
    </span>
  );
}

export default function HistoryPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setLoading(true);
    fetchClaims({ status: statusFilter || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then(res => setClaims(res.claims))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Claim History</h1>
          <p className="text-gray-500 text-sm mt-1">Full log of all fee claims</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          {/* CSV Export */}
          <button
            onClick={exportClaimsCSV}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-sm px-4 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            ↓ Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading...</div>
      ) : claims.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
          <p className="text-gray-400">No claims found</p>
        </div>
      ) : (
        <>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="text-left px-5 py-3">Project</th>
                  <th className="text-right px-5 py-3">SOL</th>
                  <th className="text-right px-5 py-3">Tokens Bought</th>
                  <th className="text-right px-5 py-3">Boxes</th>
                  <th className="text-left px-5 py-3">Claim TX</th>
                  <th className="text-left px-5 py-3">Claimed At</th>
                  <th className="text-left px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {claims.map(claim => (
                  <tr key={claim.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium">{claim.projects?.project_name || 'Unknown'}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        {claim.projects?.token_address?.slice(0, 6)}...
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono">◎ {Number(claim.sol_amount).toFixed(6)}</td>
                    <td className="px-5 py-3 text-right font-mono text-green-400">
                      {claim.buybacks?.[0]
                        ? Number(claim.buybacks[0].token_amount).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {claim.distributions?.[0]?.boxes_created || '—'}
                    </td>
                    <td className="px-5 py-3">
                      {claim.tx_hash ? (
                        <span className="font-mono text-xs text-gray-400">
                          {claim.tx_hash.slice(0, 12)}...
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(claim.claimed_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={claim.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30 border border-gray-700 rounded-lg px-3 py-1.5"
            >
              ← Previous
            </button>
            <span className="text-gray-500 text-sm">Page {page + 1}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={claims.length < PAGE_SIZE}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30 border border-gray-700 rounded-lg px-3 py-1.5"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
