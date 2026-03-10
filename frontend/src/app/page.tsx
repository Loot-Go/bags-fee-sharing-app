'use client';

import { useEffect, useState } from 'react';
import { fetchStats, DashboardStats } from '../lib/api';

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-gray-500 text-sm mt-1">{sub}</div>}
    </div>
  );
}

function FeeSplitDiagram({ feeSharePct = 20 }: { feeSharePct?: number }) {
  const platformPct = feeSharePct * 0.25;
  const playerPct = feeSharePct * 0.75;
  const creatorPct = 100 - feeSharePct;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 col-span-2">
      <h3 className="text-sm text-gray-400 mb-4">Fee Architecture (example: {feeSharePct}% co-creator)</h3>
      <div className="flex gap-1 rounded-lg overflow-hidden h-8 mb-3">
        <div style={{ width: `${creatorPct}%` }} className="bg-blue-600 flex items-center justify-center text-xs font-bold">
          {creatorPct}% creator
        </div>
        <div style={{ width: `${playerPct}%` }} className="bg-green-600 flex items-center justify-center text-xs font-bold">
          {playerPct}% 🎁 loot
        </div>
        <div style={{ width: `${platformPct}%` }} className="bg-purple-600 flex items-center justify-center text-xs font-bold">
          {platformPct}% LootGO
        </div>
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-600 rounded-sm inline-block"></span> Creator share</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-600 rounded-sm inline-block"></span> Player loot boxes</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-600 rounded-sm inline-block"></span> LootGO platform fee</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));

    // Auto-refresh every 30s
    const interval = setInterval(() => {
      fetchStats().then(setStats).catch(console.error);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin text-4xl">⏳</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-red-400">
        <p className="font-bold">Failed to load dashboard</p>
        <p className="text-sm mt-1">{error}</p>
        <p className="text-sm mt-2 text-gray-500">Make sure the backend is running at {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Live Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time fee hunt metrics</p>
        </div>
        {stats?.pendingApprovals && stats.pendingApprovals > 0 ? (
          <a href="/queue" className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg px-4 py-2 text-sm font-medium hover:bg-yellow-500/30 transition-colors">
            ⚠️ {stats.pendingApprovals} claim{stats.pendingApprovals > 1 ? 's' : ''} pending approval
          </a>
        ) : null}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Fees Claimed"
          value={`◎ ${stats?.totalSolClaimed?.toFixed(4) ?? '0'}`}
          sub={`~$${stats?.totalSolClaimedUsd?.toFixed(2) ?? '0'} USD`}
          icon="💰"
        />
        <StatCard
          label="Buyback Volume"
          value={`◎ ${stats?.totalBuybackVolSol?.toFixed(4) ?? '0'}`}
          sub="SOL spent on buybacks"
          icon="🔄"
        />
        <StatCard
          label="Tokens Distributed"
          value={Number(stats?.totalTokensDistributed || 0).toLocaleString()}
          sub="via loot boxes"
          icon="🎁"
        />
        <StatCard
          label="Total Loot Boxes"
          value={Number(stats?.totalBoxesCreated || 0).toLocaleString()}
          sub={stats?.activeBoxesCount ? `${stats.activeBoxesCount} active` : 'Boxes created'}
          icon="📦"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Platform Fee Collected"
          value={`◎ ${stats?.totalPlatformFee?.toFixed(4) ?? '0'}`}
          sub="LootGO's 5% cut"
          icon="🏛️"
        />
        <StatCard
          label="Player Loot Pool"
          value={`◎ ${stats?.totalPlayerAmount?.toFixed(4) ?? '0'}`}
          sub="15% to players"
          icon="👾"
        />
        <StatCard
          label="Tokens Bought Back"
          value={Number(stats?.totalTokensBought || 0).toLocaleString()}
          sub="via Bags swap"
          icon="🪙"
        />
        <StatCard
          label="Unique Players"
          value={stats?.uniquePlayersReached ? stats.uniquePlayersReached.toLocaleString() : '—'}
          sub="TODO: from Distribution API"
          icon="🧑‍🤝‍🧑"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FeeSplitDiagram />
      </div>
    </div>
  );
}
