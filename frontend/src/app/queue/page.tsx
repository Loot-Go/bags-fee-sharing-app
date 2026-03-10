'use client';

import { useEffect, useState } from 'react';
import { fetchClaims, approveClaim, rejectClaim, Claim } from '../../lib/api';

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

export default function QueuePage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadClaims = async () => {
    try {
      const res = await fetchClaims({ status: 'pending' });
      setClaims(res.claims);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClaims(); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleApprove = async (claimId: string) => {
    setActionLoading(claimId);
    try {
      const result = await approveClaim(claimId);
      showToast(`✅ Approved! Buyback: ${result.tokenAmount?.toLocaleString()} tokens, ${result.distribution?.boxesCreated} boxes created`);
      await loadClaims();
    } catch (e: unknown) {
      showToast(`❌ ${e instanceof Error ? e.message : 'Approve failed'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (claimId: string) => {
    const reason = window.prompt('Reason for rejection (optional):') || 'Rejected by operator';
    setActionLoading(claimId);
    try {
      await rejectClaim(claimId, reason);
      showToast('Claim rejected');
      await loadClaims();
    } catch (e: unknown) {
      showToast(`❌ ${e instanceof Error ? e.message : 'Reject failed'}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm z-50 shadow-xl max-w-md">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Approval Queue</h1>
          <p className="text-gray-500 text-sm mt-1">
            Claims require manual approval before buyback executes. {claims.length} pending.
          </p>
        </div>
        <button
          onClick={loadClaims}
          className="text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading...</div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-red-400">{error}</div>
      ) : claims.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-gray-400">No pending claims — queue is clear!</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                <th className="text-left px-5 py-3">Project</th>
                <th className="text-right px-5 py-3">SOL Amount</th>
                <th className="text-right px-5 py-3">Platform Fee</th>
                <th className="text-right px-5 py-3">Player Loot</th>
                <th className="text-left px-5 py-3">Claimed At</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map(claim => (
                <tr key={claim.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-medium">{claim.projects?.project_name || 'Unknown'}</div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">
                      {claim.projects?.token_address?.slice(0, 8)}...
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right font-mono">◎ {Number(claim.sol_amount).toFixed(6)}</td>
                  <td className="px-5 py-4 text-right font-mono text-purple-400">◎ {Number(claim.platform_fee).toFixed(6)}</td>
                  <td className="px-5 py-4 text-right font-mono text-green-400">◎ {Number(claim.player_amount).toFixed(6)}</td>
                  <td className="px-5 py-4 text-gray-400">
                    {new Date(claim.claimed_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={claim.status} /></td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleApprove(claim.id)}
                        disabled={actionLoading === claim.id}
                        className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                      >
                        {actionLoading === claim.id ? '...' : '✓ Approve'}
                      </button>
                      <button
                        onClick={() => handleReject(claim.id)}
                        disabled={actionLoading === claim.id}
                        className="bg-gray-700 hover:bg-red-900/50 text-gray-300 hover:text-red-400 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                      >
                        ✗ Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
