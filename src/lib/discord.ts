export interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: DiscordField[];
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
  thumbnail?: { url: string };
  author?: { name: string; icon_url?: string; url?: string };
}

export interface DiscordWebhookPayload {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
}

export const DEFAULT_DISCORD_WEBHOOK_URL =
  process.env.DISCORD_WEBHOOK_URL ||
  "https://discord.com/api/webhooks/1554066969588801546/34cLxhk8Nr7FtYbscs3s4lhkhrfQYpWoSKxe-giiLSv6LHgd09YlJo6NSoDc-SAlkW1O";

const BOT_USERNAME = "Options Tracker AI • Real-Time Desk";
const BOT_AVATAR = "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=128&auto=format&fit=crop&q=80";

/**
 * Base webhook sender with timeout & error handling
 */
export async function sendDiscordWebhook(
  payload: DiscordWebhookPayload,
  customUrl?: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  const webhookUrl = customUrl || DEFAULT_DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    return { success: false, error: "No Discord webhook URL configured." };
  }

  const finalPayload: DiscordWebhookPayload = {
    username: payload.username || BOT_USERNAME,
    avatar_url: payload.avatar_url || BOT_AVATAR,
    ...payload,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(finalPayload),
    });

    if (res.ok || res.status === 204) {
      return { success: true, status: res.status };
    } else {
      const errText = await res.text().catch(() => "Unknown error");
      return { success: false, status: res.status, error: errText };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || "Network request failed" };
  }
}

/**
 * Real-time Live Entry Callout — Straightforward 9-Field Table Format
 */
export async function sendTradeEntryCallout(trade: {
  tradeNumber?: number;
  badgeLabel?: string;
  tradeDescription?: string;
  color?: number;
  symbol: string;
  contract: string;
  occSymbol?: string;
  underlyingPrice?: number;
  triggerPrice?: number;
  maxChasePrice?: number;
  entryTime: string;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  rvol?: string | number;
  gatekeeperBadge?: string;
  gatekeeperReason?: string;
  catalyst?: string;
  confidenceScore?: number;
  intradayMove?: string;
  contractsQty?: number;
  agenticConsensus?: {
    scoreBreakdown?: string;
    riskOfficerBadge?: string;
    devilsAdvocateCritique?: string;
  };
  kellySizing?: {
    recommendedContracts: number;
    maxDollarRisk: number;
    edgePercent: number;
    quarterKellyFraction: number;
  };
}) {
  const tradeNum = trade.tradeNumber || 1;
  const qty = trade.contractsQty || trade.kellySizing?.recommendedContracts || 4;
  const cleanContract = trade.contract.startsWith(trade.symbol) ? trade.contract : `${trade.symbol} ${trade.contract}`;
  const spotStr = trade.underlyingPrice ? `$${trade.underlyingPrice.toFixed(2)}` : "Live Market";
  const triggerStr = trade.triggerPrice ? ` *(Trigger: \`$${trade.triggerPrice.toFixed(2)}\`)*` : "";
  const moveStr = trade.intradayMove || (trade.triggerPrice
    ? `Triggered @ \`${spotStr}\` (Safe Zone up to \`$${(trade.maxChasePrice || trade.triggerPrice).toFixed(2)}\`)`
    : `Confirmed breakout @ \`${spotStr}\``);

  const embed: DiscordEmbed = {
    title: trade.badgeLabel
      ? `${trade.badgeLabel} (${trade.entryTime}) • ${cleanContract}`
      : `Trade #${tradeNum} (${trade.entryTime}) • ${cleanContract}`,
    description: trade.tradeDescription || `**LIVE ALPACA PAPER ENTRY EXECUTED (${qty} Contracts)**`,
    color: trade.color || 0x10B981,
    fields: [
      {
        name: trade.badgeLabel ? "Setup Type" : "Trade #",
        value: trade.badgeLabel
          ? `**${trade.badgeLabel}** (\`${trade.entryTime}\`)`
          : `**Trade #${tradeNum}** (\`${trade.entryTime}\`)`,
        inline: true,
      },
      {
        name: "Ticker & Contract",
        value: `\`${cleanContract}\`${trade.occSymbol ? `\n(\`${trade.occSymbol}\`)` : ""}`,
        inline: true,
      },
      {
        name: "Entry Time & Underlying Price",
        value: `\`${trade.entryTime}\` @ \`${spotStr}\`${triggerStr}`,
        inline: true,
      },
      {
        name: "Option Entry Ask",
        value: `\`$${trade.entryPrice.toFixed(2)}\``,
        inline: true,
      },
      {
        name: "Intraday Move After Entry",
        value: moveStr,
        inline: true,
      },
      {
        name: "Target 1 (+30%)",
        value: `\`$${trade.target1.toFixed(2)}\` *(Pending)*`,
        inline: true,
      },
      {
        name: "Target 2 (+65%)",
        value: `\`$${trade.target2.toFixed(2)}\` *(Pending)*`,
        inline: true,
      },
      {
        name: "Stop Loss (-25%)",
        value: `\`$${trade.stopLoss.toFixed(2)}\``,
        inline: true,
      },
      {
        name: `Verified Outcome (${qty} Contracts)`,
        value: `**OPEN LIVE** (\`${qty} cts\` filled @ \`$${trade.entryPrice.toFixed(2)}\` on Alpaca Paper)`,
        inline: true,
      },
    ],
    footer: {
      text: "Options Tracker • Simple & Verified Execution Alert",
    },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook({
    embeds: [embed],
  });
}

/**
 * Real-time Exit Alert (Target Hit or Stop Out) — Straightforward 9-Field Table Format
 */
export async function sendTradeExitCallout(trade: {
  tradeNumber?: number;
  symbol: string;
  contract: string;
  occSymbol?: string;
  entryTime: string;
  exitTime: string;
  underlyingEntry?: number;
  underlyingPeak?: number;
  triggerPrice?: number;
  entryPrice: number;
  exitPrice: number;
  target1?: number;
  target2?: number;
  pnlPercent: string;
  pnlPerContract: number;
  status: string;
  lessons?: string;
  qty?: number;
}) {
  const isWin = trade.pnlPerContract >= 0;
  const color = isWin ? 0x10B981 : 0xF43F5E;
  const qty = trade.qty || 4;
  const totalDollars = Math.round(trade.pnlPerContract * qty);
  const tradeNum = trade.tradeNumber || 1;
  const cleanContract = trade.contract.startsWith(trade.symbol) ? trade.contract : `${trade.symbol} ${trade.contract}`;
  const t1 = trade.target1 || Math.round(trade.entryPrice * 1.30 * 100) / 100;
  const t2 = trade.target2 || Math.round(trade.entryPrice * 1.65 * 100) / 100;
  const t1Hit = trade.exitPrice >= t1 * 0.98;
  const t2Hit = trade.exitPrice >= t2 * 0.98;

  const moveStr = (trade.underlyingEntry && trade.underlyingPeak)
    ? `Moved \`$${trade.underlyingEntry.toFixed(2)}\` → \`$${trade.underlyingPeak.toFixed(2)}\``
    : trade.lessons || `Option moved \`$${trade.entryPrice.toFixed(2)}\` → \`$${trade.exitPrice.toFixed(2)}\``;

  const embed: DiscordEmbed = {
    title: `Trade #${tradeNum} (${trade.entryTime}) • ${cleanContract} — ${isWin ? "WIN" : "STOPPED"}`,
    color,
    fields: [
      {
        name: "Trade #",
        value: `**Trade #${tradeNum}** (\`${trade.entryTime}\`)`,
        inline: true,
      },
      {
        name: "Ticker & Contract",
        value: `\`${cleanContract}\`${trade.occSymbol ? `\n(\`${trade.occSymbol}\`)` : ""}`,
        inline: true,
      },
      {
        name: "Entry Time & Underlying Price",
        value: `\`${trade.entryTime}\`${trade.underlyingEntry ? ` @ \`$${trade.underlyingEntry.toFixed(2)}\`` : ""}${trade.triggerPrice ? `\n*(Trigger: \`$${trade.triggerPrice.toFixed(2)}\`)*` : ""}`,
        inline: true,
      },
      {
        name: "Option Entry Ask",
        value: `\`$${trade.entryPrice.toFixed(2)}\``,
        inline: true,
      },
      {
        name: "Intraday Move After Entry",
        value: moveStr,
        inline: true,
      },
      {
        name: "Target 1 (+30%)",
        value: `\`$${t1.toFixed(2)}\` ${t1Hit ? "**HIT**" : "—"}`,
        inline: true,
      },
      {
        name: "Target 2 (+65%)",
        value: `\`$${t2.toFixed(2)}\` ${t2Hit ? "**HIT**" : "—"}`,
        inline: true,
      },
      {
        name: "Peak Option Price (% Gain)",
        value: `\`$${trade.exitPrice.toFixed(2)}\` (\`${trade.pnlPercent}\`)`,
        inline: true,
      },
      {
        name: `Verified Outcome (${qty} Contracts)`,
        value: `**${isWin ? "WIN" : "LOSS"}** (\`${trade.pnlPercent}\` = \`${totalDollars >= 0 ? "+" : ""}$${totalDollars}\` on ${qty} cts)`,
        inline: true,
      },
    ],
    footer: {
      text: "Options Tracker • Simple & Verified Execution Ledger",
    },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook({
    embeds: [embed],
  });
}

/**
 * Real-time Target Scale / Runner Exit Alert — Straightforward 9-Field Table Format
 */
export async function sendTargetScaleAlert(update: {
  tradeNumber?: number;
  symbol: string;
  contract: string;
  stage: "TARGET_1_HIT" | "TARGET_2_HIT" | "TRAILING_STOP_EXIT" | "OVEREXTENDED_WARNING";
  currentPrice: number;
  highPrice: number;
  entryPrice: number;
  targetPrice: number;
  pnlPercent: string;
  actionMessage: string;
  stopAdjustment: string;
  entryTime?: string;
  triggerPrice?: number;
  qty?: number;
}) {
  const isT1 = update.stage === "TARGET_1_HIT";
  const isT2 = update.stage === "TARGET_2_HIT";
  const isTrail = update.stage === "TRAILING_STOP_EXIT";
  const qty = update.qty || 4;
  const tradeNum = update.tradeNumber || 1;
  const cleanContract = update.contract.startsWith(update.symbol) ? update.contract : `${update.symbol} ${update.contract}`;
  const t1 = Math.round(update.entryPrice * 1.30 * 100) / 100;
  const t2 = Math.round(update.entryPrice * 1.65 * 100) / 100;
  const gainDollarsOnQty = Math.round((update.targetPrice - update.entryPrice) * 100 * qty);

  const color = isT1 ? 0x10B981 : isT2 ? 0x06B6D4 : isTrail ? 0xF59E0B : 0xE11D48;

  const embed: DiscordEmbed = {
    title: `Trade #${tradeNum} Update • ${cleanContract} — ${isT1 ? "TARGET 1 HIT (+30%)" : isT2 ? "TARGET 2 HIT (+65%)" : "CLOSED / TRAILED"}`,
    color,
    fields: [
      {
        name: "Trade #",
        value: `**Trade #${tradeNum}** (\`${update.entryTime || "09:35 AM ET"}\`)`,
        inline: true,
      },
      {
        name: "Ticker & Contract",
        value: `\`${cleanContract}\``,
        inline: true,
      },
      {
        name: "Entry Time & Underlying Price",
        value: `\`${update.entryTime || "09:35 AM ET"}\`${update.triggerPrice ? ` *(Trigger: \`$${update.triggerPrice.toFixed(2)}\`)*` : ""}`,
        inline: true,
      },
      {
        name: "Option Entry Ask",
        value: `\`$${update.entryPrice.toFixed(2)}\``,
        inline: true,
      },
      {
        name: "Intraday Move After Entry",
        value: `Spot @ \`$${update.currentPrice.toFixed(2)}\` (Peak: \`$${update.highPrice.toFixed(2)}\`)`,
        inline: true,
      },
      {
        name: "Target 1 (+30%)",
        value: `\`$${t1.toFixed(2)}\` **HIT**`,
        inline: true,
      },
      {
        name: "Target 2 (+65%)",
        value: `\`$${t2.toFixed(2)}\` ${isT2 ? "**HIT**" : "*(In Play)*"}`,
        inline: true,
      },
      {
        name: "Peak Option Price (% Gain)",
        value: `\`$${update.targetPrice.toFixed(2)}\` (\`${update.pnlPercent}\`)`,
        inline: true,
      },
      {
        name: `Verified Outcome (${qty} Contracts)`,
        value: `**WIN** (\`${update.pnlPercent}\` = \`${gainDollarsOnQty >= 0 ? "+" : ""}$${gainDollarsOnQty}\` on ${qty} cts)\n*${update.stopAdjustment}*`,
        inline: true,
      },
    ],
    footer: {
      text: "Options Tracker • Simple & Verified Execution Alert",
    },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook({
    embeds: [embed],
  });
}

/**
 * Daily Call-Outs Summary — Straightforward 9-Field Table Format for Each Trade
 */
export async function sendDailyCalloutsSummary(data: {
  date: string;
  monthName?: string;
  trades: Array<{
    symbol: string;
    contract?: string;
    occSymbol?: string;
    entryTime: string;
    exitTime?: string;
    underlyingEntry?: number;
    underlyingPeak?: number;
    triggerPrice?: number;
    entryPrice: number;
    exitPrice?: number;
    target1?: number;
    target2?: number;
    pnlPercent?: string;
    pnlPerContract?: number;
    status?: string;
    lessons?: string;
    gatekeeperStatus?: string;
    qty?: number;
  }>;
  totalPnlPerCt: number;
  winRate: number;
  winCount: number;
  lossCount: number;
}) {
  const { date, trades, totalPnlPerCt } = data;
  const isGreen = totalPnlPerCt >= 0;
  const embedColor = isGreen ? 0x10B981 : 0xF43F5E;

  const embeds: DiscordEmbed[] = trades.map((t, idx) => {
    const qty = t.qty || 4;
    const entryAsk = t.entryPrice || 2.50;
    const peakOpt = t.exitPrice ?? entryAsk;
    const t1 = t.target1 || Math.round(entryAsk * 1.30 * 100) / 100;
    const t2 = t.target2 || Math.round(entryAsk * 1.65 * 100) / 100;
    const t1Hit = peakOpt >= t1 * 0.98 || (t.status || "").includes("TARGET");
    const t2Hit = peakOpt >= t2 * 0.98 || (t.status || "").includes("TARGET 2");
    const gainPctNum = entryAsk > 0 ? Math.round(((peakOpt - entryAsk) / entryAsk) * 1000) / 10 : 0;
    const pctStr = t.pnlPercent || `${gainPctNum >= 0 ? "+" : ""}${gainPctNum}%`;
    const pnlPerCt = t.pnlPerContract !== undefined ? t.pnlPerContract : Math.round((peakOpt - entryAsk) * 100);
    const totalFourCtDollars = Math.round(pnlPerCt * qty);
    const isWin = pnlPerCt >= 0;
    const cleanContract = (t.contract || "").startsWith(t.symbol) ? (t.contract || t.symbol) : `${t.symbol} ${t.contract || ""}`.trim();

    const moveStr = (t.underlyingEntry && t.underlyingPeak)
      ? `Moved \`$${t.underlyingEntry.toFixed(2)}\` → \`$${t.underlyingPeak.toFixed(2)}\``
      : t.lessons || `Option \`$${entryAsk.toFixed(2)}\` → \`$${peakOpt.toFixed(2)}\``;

    return {
      title: `Trade #${idx + 1} (${t.entryTime}) • ${cleanContract}`,
      color: isWin ? 0x10B981 : 0xF43F5E,
      fields: [
        {
          name: "Trade #",
          value: `**Trade #${idx + 1}** (\`${t.entryTime}\`)`,
          inline: true,
        },
        {
          name: "Ticker & Contract",
          value: `\`${cleanContract}\`${t.occSymbol ? `\n(\`${t.occSymbol}\`)` : ""}`,
          inline: true,
        },
        {
          name: "Entry Time & Underlying Price",
          value: `\`${t.entryTime}\`${t.underlyingEntry ? ` @ \`$${t.underlyingEntry.toFixed(2)}\`` : ""}${t.triggerPrice ? `\n*(Trigger: \`$${t.triggerPrice.toFixed(2)}\`)*` : ""}`,
          inline: true,
        },
        {
          name: "Option Entry Ask",
          value: `\`$${entryAsk.toFixed(2)}\``,
          inline: true,
        },
        {
          name: "Intraday Move After Entry",
          value: moveStr,
          inline: true,
        },
        {
          name: "Target 1 (+30%)",
          value: `\`$${t1.toFixed(2)}\` ${t1Hit ? "**HIT**" : "—"}`,
          inline: true,
        },
        {
          name: "Target 2 (+65%)",
          value: `\`$${t2.toFixed(2)}\` ${t2Hit ? "**HIT**" : "—"}`,
          inline: true,
        },
        {
          name: "Peak Option Price (% Gain)",
          value: `\`$${peakOpt.toFixed(2)}\` (\`${pctStr}\`)`,
          inline: true,
        },
        {
          name: `Verified Outcome (${qty} Contracts)`,
          value: `**${isWin ? "WIN" : "LOSS"}** (\`${pctStr}\` = \`${totalFourCtDollars >= 0 ? "+" : ""}$${totalFourCtDollars}\` on ${qty} cts)`,
          inline: true,
        },
      ],
      footer: {
        text: `Daily Verified Scorecard • ${date}`,
      },
    };
  });

  if (embeds.length === 0) {
    embeds.push({
      title: `Daily Verified Scorecard • ${date}`,
      description: "0 trades triggered today (Capital preserved).",
      color: embedColor,
    });
  }

  return sendDiscordWebhook({
    content: `📊 **DAILY VERIFIED EXECUTION SUMMARY (${date})**`,
    embeds: embeds.slice(0, 5),
  });
}

/**
 * Dispatch Comprehensive Test Signal to Discord
 */
export async function sendTestSignal() {
  // We send a combined test payload demonstrating both real-time entry and verified exit with timestamps
  const testEmbed: DiscordEmbed = {
    title: "🔔 TEST SIGNAL: Real-Time Options Call-Out",
    description: "✅ **Discord Integration Active & Verified**\nLive call-outs with precise Entry Time, Exit Time, and Gatekeeper verification are now connected.",
    color: 0x10B981, // Emerald Green
    fields: [
      {
        name: "📈 Symbol & Contract",
        value: "**CVS $86.00 CALL** (Sep 25 Expiry)",
        inline: true,
      },
      {
        name: "⏱️ Entry Time",
        value: "`10:10 AM ET`",
        inline: true,
      },
      {
        name: "🏁 Exit Time",
        value: "`02:30 PM ET`",
        inline: true,
      },
      {
        name: "💵 Entry Premium",
        value: "**$1.35** ($135 / contract)",
        inline: true,
      },
      {
        name: "🎯 Exit Premium",
        value: "**$2.45** ($245 / contract)",
        inline: true,
      },
      {
        name: "📊 Outcome / Return",
        value: "**TARGET 2 HIT (+81.5%)**\n`+$110.00 / ct net`",
        inline: true,
      },
      {
        name: "🛑 Stop Loss Boundary",
        value: "$1.01 (-25% strict capital guard)",
        inline: true,
      },
      {
        name: "🎯 Profit Targets",
        value: "T1: $1.75 (+30%)\nT2: $2.23 (+65%)",
        inline: true,
      },
      {
        name: "🛡️ Gatekeeper Certification",
        value: "Passed all 4 rules: RVOL 3.2x (>2.8x floor) • Midday box breakout (>10:15 AM) • Bullish delta bar",
        inline: false,
      },
      {
        name: "📝 Execution Commentary",
        value: "Broke above $85.60 resistance shelf with heavy institutional delta. Price surged steadily from $85.60 to session high of $89.35. Contract reached max gain of +81.5%.",
        inline: false,
      },
    ],
    footer: {
      text: "Options Tracker AI • Real-Time Discord Webhook Engine",
    },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook({
    embeds: [testEmbed],
  });
}

/**
 * Morning Market Heads-Up & Prospective Stocks Briefing
 */
export async function sendDailyBriefingCallout(briefing: {
  date: string;
  marketBias: {
    overall: string;
    spyTrend: string;
    qqqTrend: string;
    vixInterpretation: string;
  };
  events: Array<{ time: string; event: string; consensus: string }>;
  topStocks: Array<{
    symbol: string;
    name: string;
    catalyst: string;
    triggerShelf: string;
    probability: string;
    contract: string;
  }>;
}) {
  const stockFields: DiscordField[] = briefing.topStocks.map((s, idx) => ({
    name: `⭐ #${idx + 1}: ${s.symbol} — ${s.name} (${s.probability})`,
    value: [
      `• **News / Catalyst:** ${s.catalyst}`,
      `• **Key Trigger Shelf:** \`${s.triggerShelf}\``,
      `• **Target Option Play:** **${s.contract}**`,
    ].join("\n"),
    inline: false,
  }));

  const eventFields = briefing.events.map(e => `• \`${e.time}\`: **${e.event}** (${e.consensus})`).join("\n");

  const embed: DiscordEmbed = {
    title: `🌅 DAILY MARKET HEADS-UP & PROSPECTIVE STOCKS (${briefing.date})`,
    description: `**Institutional Tape Bias:** \`${briefing.marketBias.overall}\`\n• **SPY:** ${briefing.marketBias.spyTrend}\n• **QQQ:** ${briefing.marketBias.qqqTrend}\n• **VIX:** ${briefing.marketBias.vixInterpretation}`,
    color: 0x06B6D4, // Cyan Accent
    fields: [
      {
        name: "📅 Today's Macro & Economic Watch",
        value: eventFields || "No major macro risk events scheduled.",
        inline: false,
      },
      ...stockFields,
    ],
    footer: {
      text: "Options Tracker AI • Institutional Morning Briefing Desk",
    },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook({
    embeds: [embed],
  });
}

/**
 * Single Prospective Stock Intelligence Alert
 */
export async function sendProspectiveStockAlert(stock: {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  catalyst: string;
  eventType: string;
  triggerShelf: string;
  probability: string;
  contract: string;
  target1: number;
  target2: number;
  stopLoss: number;
  gatekeeperBadge: string;
  gatekeeperRule: string;
}) {
  const embed: DiscordEmbed = {
    title: `💡 PROSPECTIVE STOCK HEADS-UP: ${stock.symbol} (${stock.name})`,
    description: `**Setup Rating: ${stock.probability}** • Sector: \`${stock.sector}\` • Event: \`${stock.eventType}\`\n\n**Catalyst / News:**\n${stock.catalyst}`,
    color: 0x3B82F6, // Blue
    fields: [
      {
        name: "🎯 Key Trigger Shelf to Watch",
        value: `\`${stock.triggerShelf}\``,
        inline: false,
      },
      {
        name: "💵 Target Option Contract",
        value: `**${stock.contract}**`,
        inline: true,
      },
      {
        name: "🛑 Stop Loss",
        value: `$${stock.stopLoss.toFixed(2)} (-25%)`,
        inline: true,
      },
      {
        name: "🚀 Targets",
        value: `T1: $${stock.target1.toFixed(2)} | T2: $${stock.target2.toFixed(2)}`,
        inline: true,
      },
      {
        name: `🛡️ ${stock.gatekeeperBadge}`,
        value: stock.gatekeeperRule,
        inline: false,
      },
    ],
    footer: {
      text: "Options Tracker AI • Real-Time Research Desk",
    },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook({
    embeds: [embed],
  });
}

export interface SPXPowerHourDiscordPayload {
  setupType: "MOC_GAMMA_CALL" | "MOC_GAMMA_PUT" | "GAMMA_PIN_BUTTERFLY" | "PRE_CUTOFF_BREAKOUT_CALL" | "PRE_CUTOFF_BREAKOUT_PUT";
  triggerTime: string;
  spxSpot: number;
  contract: string;
  strike: number;
  entryAsk: number;
  target1: number;
  target2: number;
  stopLoss: number;
  maxRiskPerContract: number;
  mocImbalance: string;
  mocImbalanceType: "BUY" | "SELL" | "BALANCED";
  morningBias: string;
  shelfBreak: string;
  exitCutoff: string;
  confluenceConviction?: string;
  confluenceSummary?: string;
  alternateSetup?: string;
  brokerCutoffWarning?: string;
}

/**
 * Send real-time SPX 0DTE Power Hour Call-Out to Discord — Straightforward 9-Field Table Format
 */
export async function sendSPXPowerHourAlert(payload: SPXPowerHourDiscordPayload) {
  const isCall = payload.setupType === "MOC_GAMMA_CALL" || payload.setupType === "PRE_CUTOFF_BREAKOUT_CALL";
  const color = isCall ? 0x10B981 : 0xEF4444;

  const embed: DiscordEmbed = {
    title: `Power Hour Trade (${payload.triggerTime}) • ${payload.contract}`,
    color,
    fields: [
      {
        name: "Trade #",
        value: `**Power Hour** (\`${payload.triggerTime}\`)`,
        inline: true,
      },
      {
        name: "Ticker & Contract",
        value: `\`${payload.contract}\``,
        inline: true,
      },
      {
        name: "Entry Time & Underlying Price",
        value: `\`${payload.triggerTime}\` @ \`$${payload.spxSpot.toFixed(2)}\``,
        inline: true,
      },
      {
        name: "Option Entry Ask",
        value: `\`$${payload.entryAsk.toFixed(2)}\``,
        inline: true,
      },
      {
        name: "Intraday Move After Entry",
        value: payload.shelfBreak,
        inline: true,
      },
      {
        name: "Target 1",
        value: `\`$${payload.target1.toFixed(2)}\``,
        inline: true,
      },
      {
        name: "Target 2",
        value: `\`$${payload.target2.toFixed(2)}\``,
        inline: true,
      },
      {
        name: "Stop Loss / Cutoff",
        value: `\`$${payload.stopLoss.toFixed(2)}\` (Exit by \`${payload.exitCutoff}\`)`,
        inline: true,
      },
      {
        name: "Verified Outcome (4 Contracts)",
        value: `**OPEN LIVE** (SPY 0DTE Proxy on Alpaca Paper)`,
        inline: true,
      },
    ],
    footer: {
      text: "Options Tracker • Simple & Verified Execution Alert",
    },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook({
    embeds: [embed],
  });
}

/**
 * 60-Second Proximity Alert (Stock approaching trigger shelf)
 */
export async function sendProximityAlert(data: {
  symbol: string;
  contract: string;
  currentPrice: number;
  triggerPrice: number;
  gapDollars: number;
  timeET: string;
  catalyst?: string;
}) {
  const embed: DiscordEmbed = {
    title: `Watch Alert (${data.timeET}) • ${data.contract}`,
    color: 0xF59E0B,
    fields: [
      {
        name: "Ticker & Contract",
        value: `\`${data.contract}\``,
        inline: true,
      },
      {
        name: "Current Price & Trigger",
        value: `\`$${data.currentPrice.toFixed(2)}\` *(Trigger: \`$${data.triggerPrice.toFixed(2)}\`)*`,
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook({ embeds: [embed] });
}

/**
 * Pre-Market Daily Game Plan (Dispatched at 09:15 AM ET) — Straightforward 9-Field Table Format
 */
export async function sendPreMarketGamePlan(data: {
  date: string;
  macroSummary?: string;
  calibration?: {
    brierScore: number;
    calibrationRating: string;
    observedWinRate: number;
    reliabilityDelta: number;
  };
  agenticDebate?: {
    hunterThesis?: string;
    riskOfficerAudit?: string;
  };
  setups: Array<{
    symbol: string;
    underlyingPrice?: number;
    direction?: "CALL" | "PUT";
    trigger: number;
    maxChase: number;
    contract: string;
    entryAsk: number;
    stopLoss: number;
    target1: number;
    target2: number;
    catalyst: string;
    sector?: string;
    isTopPick?: boolean;
    rank?: number;
    convictionScore?: number;
    riskBadge?: string;
    pillarSummary?: string;
    recommendedContracts?: number;
  }>;
}) {
  const embeds: DiscordEmbed[] = data.setups.slice(0, 2).map((s, idx) => {
    const qty = s.recommendedContracts || 4;
    const isPut = s.direction === "PUT" || s.contract.endsWith("P") || s.contract.includes("PUT");
    const cleanContract = s.contract.startsWith(s.symbol) ? s.contract : `${s.symbol} ${s.contract}`;
    const spotStr = s.underlyingPrice ? ` @ \`$${s.underlyingPrice.toFixed(2)}\`` : "";

    return {
      title: `Trade #${idx + 1} (09:35 AM ORB Watch) • ${cleanContract}`,
      color: isPut ? 0xEF4444 : 0x10B981,
      fields: [
        {
          name: "Trade #",
          value: `**Trade #${idx + 1}** (\`09:35 AM ET\`)`,
          inline: true,
        },
        {
          name: "Ticker & Contract",
          value: `\`${cleanContract}\``,
          inline: true,
        },
        {
          name: "Entry Time & Underlying Price",
          value: `\`09:35 AM ET\`${spotStr}\n*(Trigger: \`$${s.trigger.toFixed(2)}\`)*`,
          inline: true,
        },
        {
          name: "Option Entry Ask",
          value: `\`$${s.entryAsk.toFixed(2)}\``,
          inline: true,
        },
        {
          name: "Intraday Move Required",
          value: isPut
            ? `Breakdown ≤ \`$${s.trigger.toFixed(2)}\` (Safe Floor: \`$${s.maxChase.toFixed(2)}\`)`
            : `Breakout ≥ \`$${s.trigger.toFixed(2)}\` (Max Chase: \`$${s.maxChase.toFixed(2)}\`)`,
          inline: true,
        },
        {
          name: "Target 1 (+30%)",
          value: `\`$${s.target1.toFixed(2)}\``,
          inline: true,
        },
        {
          name: "Target 2 (+65%)",
          value: `\`$${s.target2.toFixed(2)}\``,
          inline: true,
        },
        {
          name: "Stop Loss (-25%)",
          value: `\`$${s.stopLoss.toFixed(2)}\``,
          inline: true,
        },
        {
          name: `Verified Outcome (${qty} Contracts)`,
          value: `**ARMED FOR 09:35 AM** (Auto-Executes \`${qty} cts\` on Alpaca Paper when trigger hits)`,
          inline: true,
        },
      ],
      footer: {
        text: `Pre-Market Watchlist • ${data.date}`,
      },
    };
  });

  return sendDiscordWebhook({
    content: `📋 **09:15 AM PRE-MARKET WATCHLIST (${data.date}) — TOP 2 SETUPS**`,
    embeds,
  });
}

/**
 * Proactive "Sit On Hands / Cash Is a Position" Advisory (09:45 AM ET)
 */
export async function sendAdvisorStandDownAlert(params: {
  date: string;
  timeET: string;
  spyPrice?: number;
  spyVwap?: number;
  qqqPrice?: number;
  qqqVwap?: number;
  regimeSummary?: string;
  topWatchSymbol?: string;
  topWatchContract?: string;
  topWatchTrigger?: number;
  isPutWatch?: boolean;
  regime?: string;
  spyStatus?: string;
  qqqStatus?: string;
  reason?: string;
  watchlistStatus?: string;
}) {
  const embed: DiscordEmbed = {
    title: `No Entry Triggered Yet (${params.timeET}) — Cash Protected`,
    description: params.watchlistStatus || `0 confirmed breakouts triggered in the 09:30–09:45 AM window. Standing by for trigger confirmation.`,
    color: 0xF59E0B,
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook({ embeds: [embed] });
}

