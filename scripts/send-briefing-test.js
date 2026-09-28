const https = require('https');

const webhookUrl = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1554066969588801546/34cLxhk8Nr7FtYbscs3s4lhkhrfQYpWoSKxe-giiLSv6LHgd09YlJo6NSoDc-SAlkW1O';

const briefingPayload = {
  username: 'Options Tracker AI • Institutional Desk',
  avatar_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=128&auto=format&fit=crop&q=80',
  embeds: [
    {
      title: '🌅 DAILY MARKET HEADS-UP & PROSPECTIVE STOCKS (Today\'s Session)',
      description: '**Institutional Tape Bias:** `BULLISH RISK-ON`\n• **SPY:** Holding above 20-day EMA $564.80 (Targeting $575 ATH Extension)\n• **QQQ:** AI Cloud & Semi Momentum Above $485.50 Shelf (RSI 61)\n• **VIX:** 15.2 (Low-Vol Grind) • Favors clean directional call breakouts',
      color: 0x06B6D4, // Cyan Accent
      fields: [
        {
          name: '📅 Today\'s Macro & Economic Watch',
          value: '• `08:30 AM ET`: **Core PCE Price Index** (+0.2% MoM / +2.6% YoY)\n• `10:00 AM ET`: **ISM Manufacturing PMI** (49.2 Exp)\n• `01:00 PM ET`: **US 10-Yr Note Auction** (Strong Bid)\n• `02:00 PM ET`: **Fed Vice Chair Remarks** (Rate-Cut Validation)',
          inline: false
        },
        {
          name: '⭐ #1: NVDA — NVIDIA Corp. (95% ELITE)',
          value: '• **News / Catalyst:** Blackwell Ultra GB200 volume shipments accelerated; hyperscaler 2026 capex raised +$32B.\n• **Key Trigger Shelf:** `Breakout > $226.50 ORB High • Support $223.80`\n• **Target Option Play:** **NVDA $230C @ ~$2.45** (T1: $3.20 | T2: $4.05)',
          inline: false
        },
        {
          name: '⭐ #2: CVS — CVS Health Corp. (92% ELITE)',
          value: '• **News / Catalyst:** Pharmacy Services Margin beat + CMS Star ratings appeal settlement reversal ($1.2B CF addition).\n• **Key Trigger Shelf:** `Midday Box Breakout > $85.60 Shelf (Confirmed after 10:15 AM ET)`\n• **Target Option Play:** **CVS $86C @ ~$1.35** (T1: $1.75 | T2: $2.45)',
          inline: false
        },
        {
          name: '⭐ #3: META — Meta Platforms (94% ELITE)',
          value: '• **News / Catalyst:** Llama 4 multi-modal release (40% latency reduction) + AI ad ROAS up 28%.\n• **Key Trigger Shelf:** `Breakout > $758.00 morning shelf • VWAP support $751.20`\n• **Target Option Play:** **META $760C @ ~$3.10** (T1: $4.05 | T2: $5.10)',
          inline: false
        },
        {
          name: '⭐ #4: AMD — Advanced Micro Devices (91% HIGH)',
          value: '• **News / Catalyst:** Instinct MI350 cloud cluster adoption by tier-1 hyperscalers.\n• **Key Trigger Shelf:** `Breakout > $162.80 shelf • Support $159.40`\n• **Target Option Play:** **AMD $165C @ ~$2.15** (T1: $2.80 | T2: $3.55)',
          inline: false
        },
        {
          name: '⭐ #5: PLTR — Palantir Technologies (92% ELITE)',
          value: '• **News / Catalyst:** AIP Bootcamp customer conversion up 85% + US SOCOM $178M tactical AI extension.\n• **Key Trigger Shelf:** `Breakout > $38.20 resistance shelf • Support $37.30`\n• **Target Option Play:** **PLTR $38.5C @ ~$1.15** (T1: $1.50 | T2: $1.90)',
          inline: false
        },
        {
          name: '🛡️ Gatekeeper Directive for Today',
          value: '• **Semis/Tech:** Execute on confirmed 09:35 AM candle close with RVOL >= 2.8x.\n• **Defensives (CVS):** Strictly quarantine prior to 10:15 AM ET. Execute only upon midday consolidation breakout.',
          inline: false
        }
      ],
      footer: {
        text: 'Options Tracker AI • Institutional Morning Briefing Desk'
      },
      timestamp: new Date().toISOString()
    }
  ]
};

const data = JSON.stringify(briefingPayload);
const parsed = new URL(webhookUrl);
const req = https.request({
  hostname: parsed.hostname,
  path: parsed.pathname + parsed.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  console.log('Briefing Discord Status:', res.statusCode);
});
req.on('error', (e) => console.error('Error:', e));
req.write(data);
req.end();
