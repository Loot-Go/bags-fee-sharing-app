import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletContextProvider } from '../components/WalletProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LootGO: Fee Hunt',
  description: 'Turn trading fees into GPS loot boxes — powered by Bags',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen`}>
        <WalletContextProvider>
          <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎁</span>
              <span className="font-bold text-lg">LootGO: Fee Hunt</span>
              <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full px-2 py-0.5">
                DEVNET
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</a>
              <a href="/setup" className="text-sm text-gray-400 hover:text-white transition-colors">Setup</a>
              <a href="/queue" className="text-sm text-gray-400 hover:text-white transition-colors">Approval Queue</a>
              <a href="/history" className="text-sm text-gray-400 hover:text-white transition-colors">History</a>
            </div>
          </nav>
          <main className="px-6 py-8 max-w-7xl mx-auto">
            {children}
          </main>
        </WalletContextProvider>
      </body>
    </html>
  );
}
