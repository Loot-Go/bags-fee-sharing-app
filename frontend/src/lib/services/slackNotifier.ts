/**
 * Slack Notifier
 * Posts fee claim alerts to #lootgo-sales with token details.
 * Requires: SLACK_WEBHOOK_URL env var (Incoming Webhook for #lootgo-sales)
 */

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

// Slack user IDs to mention
const MENTION_JIJIN = '<@U05RCDHTJ21>';
const MENTION_YUKI  = '<@U05RF7W57NX>';

export interface NewClaimAlert {
  projectName: string;
  tokenAddress: string;
  ticker?: string;
  mcap?: number;          // USD
  solAmount: number;
  platformFee: number;
  playerAmount: number;
  txHash: string;
  dexScreenerUrl?: string;
}

export async function notifyNewClaim(alert: NewClaimAlert): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.log('[SlackNotifier] No webhook configured, skipping notification');
    return;
  }

  const {
    projectName,
    tokenAddress,
    ticker,
    mcap,
    solAmount,
    platformFee,
    playerAmount,
    txHash,
    dexScreenerUrl,
  } = alert;

  const shortMint = `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`;
  const dexUrl = dexScreenerUrl || `https://dexscreener.com/solana/${tokenAddress}`;
  const solscanUrl = `https://solscan.io/tx/${txHash}`;
  const mcapStr = mcap ? `$${(mcap / 1_000_000).toFixed(2)}M` : 'N/A';

  const message = {
    text: `🚨🚨 New Fee Claim — ${projectName}${ticker ? ` ($${ticker})` : ''}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🚨🚨 New Fee Claim — ${projectName}${ticker ? ` ($${ticker})` : ''}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Token:*\n${ticker ? `$${ticker}` : shortMint}` },
          { type: 'mrkdwn', text: `*Market Cap:*\n${mcapStr}` },
          { type: 'mrkdwn', text: `*Total Fee:*\n${solAmount.toFixed(4)} SOL` },
          { type: 'mrkdwn', text: `*Player Share:*\n${playerAmount.toFixed(4)} SOL (→ loot boxes)` },
          { type: 'mrkdwn', text: `*Platform Fee:*\n${platformFee.toFixed(4)} SOL` },
          { type: 'mrkdwn', text: `*Status:*\n⏳ Pending approval` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Links:* <${dexUrl}|DexScreener> | <${solscanUrl}|Tx on Solscan>`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${MENTION_JIJIN} ${MENTION_YUKI} — approve or reject in the <https://bags-fee-hunt.vercel.app/queue|dashboard>.`,
        },
      },
      { type: 'divider' },
    ],
  };

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      console.error(`[SlackNotifier] Webhook failed: ${res.status} ${await res.text()}`);
    } else {
      console.log(`[SlackNotifier] ✅ Alert sent for ${projectName}`);
    }
  } catch (err) {
    console.error('[SlackNotifier] Error sending alert:', err);
  }
}

export async function notifyClaimError(tokenMint: string, error: string, consecutiveFailures: number): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;

  const message = {
    text: `🚨 Fee claim failure for \`${tokenMint}\` (${consecutiveFailures} consecutive fails): ${error}`,
  };

  await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  }).catch(console.error);
}
