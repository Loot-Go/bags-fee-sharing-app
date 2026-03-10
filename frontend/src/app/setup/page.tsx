'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { registerProject } from '../../lib/api';

export default function SetupPage() {
  const { publicKey, connected } = useWallet();

  const [tokenAddress, setTokenAddress] = useState('');
  const [feeSharePct, setFeeSharePct] = useState(20);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectLogo, setProjectLogo] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fee breakdown display
  const platformPct = (feeSharePct * 0.25).toFixed(1);
  const playerPct = (feeSharePct * 0.75).toFixed(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await registerProject({
        tokenAddress,
        creatorWallet: publicKey.toString(),
        feeSharePct,
        projectName,
        projectDescription,
        projectLogo,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-green-900/20 border border-green-800 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-green-400">Project Registered!</h2>
          <p className="text-gray-400 mt-2">
            LootGO is now set as co-creator for <code className="text-green-300">{tokenAddress}</code>
          </p>
          <p className="text-gray-500 text-sm mt-3">
            Fees will be claimed automatically every hour. Check the dashboard for live stats.
          </p>
          <a
            href="/"
            className="mt-6 inline-block bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            View Dashboard →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Setup Project</h1>
        <p className="text-gray-400 mt-1">
          Register your Bags token to turn trading fees into GPS loot boxes
        </p>
      </div>

      {/* Wallet Connection */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Wallet</p>
            {connected && publicKey ? (
              <p className="text-xs text-gray-400 font-mono mt-1">
                {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Connect to verify ownership</p>
            )}
          </div>
          <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-500" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Token Address */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Token Address <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={tokenAddress}
            onChange={e => setTokenAddress(e.target.value)}
            placeholder="Solana token mint address"
            required
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono text-sm"
          />
        </div>

        {/* Project Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Project Name</label>
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="e.g. Moon Dog"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Project Logo URL */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Logo URL</label>
          <input
            type="url"
            value={projectLogo}
            onChange={e => setProjectLogo(e.target.value)}
            placeholder="https://..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
          <textarea
            value={projectDescription}
            onChange={e => setProjectDescription(e.target.value)}
            placeholder="Short description for loot box campaigns"
            rows={2}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
          />
        </div>

        {/* Fee Share Slider */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            LootGO Co-Creator Share: <span className="text-purple-400 font-bold">{feeSharePct}%</span>
          </label>
          <input
            type="range"
            min={10}
            max={50}
            step={1}
            value={feeSharePct}
            onChange={e => setFeeSharePct(parseInt(e.target.value))}
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>10%</span>
            <span>50%</span>
          </div>

          {/* Fee breakdown */}
          <div className="mt-3 bg-gray-800/50 rounded-lg p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-400">Your creator share</span>
              <span className="text-blue-400 font-medium">{100 - feeSharePct}% of trading fees</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">🎁 Player loot boxes</span>
              <span className="text-green-400 font-medium">{playerPct}% of trading fees</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">🏛️ LootGO platform fee</span>
              <span className="text-purple-400 font-medium">{platformPct}% of trading fees</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !connected}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-3 rounded-lg transition-colors"
        >
          {loading ? 'Registering...' : !connected ? 'Connect Wallet First' : 'Register Project →'}
        </button>
      </form>
    </div>
  );
}
