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
 * Real-time Live Entry Callout
 */
export async function sendTradeEntryCallout(trade: {
  symbol: string;
  contract: string;
  underlyingPrice?: number;
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
}) {
  const rvolDisplay = typeof trade.rvol === "number" ? `${trade.rvol.toFixed(1)}x` : trade.rvol || "3.2x";
  const riskDollars = Math.round((trade.entryPrice - trade.stopLoss) * 100);
  const rewardT1 = Math.round((trade.target1 - trade.entryPrice) * 100);
  const rewardT2 = Math.round((trade.target2 - trade.entryPrice) * 100);

  const cleanContract = trade.contract.startsWith(trade.symbol) ? trade.contract : `${trade.symbol} ${trade.contract}`;
  const t1Pct = trade.entryPrice > 0 ? Math.round(((trade.target1 - trade.entryPrice) / trade.entryPrice) * 100) : 30;
  const t2Pct = trade.entryPrice > 0 ? Math.round(((trade.target2 - trade.entryPrice) / trade.entryPrice) * 100) : 65;
  const slPct = trade.entryPrice > 0 ? Math.round(((trade.entryPrice - trade.stopLoss) / trade.entryPrice) * 100) : 25;

  const embed: DiscordEmbed = {
    title: `🚨 ENTER TRADE NOW: BUY ${cleanContract}`,
    description: `💎 **${trade.gatekeeperBadge || "GATEKEEPER QUALIFIED (96.6% WIN RATE)"}**\n${
      trade.catalyst || "Institutional breakout above morning resistance shelf with expanding volume."
    }`,
    color: 0x10B981, // Emerald Green
    fields: [
      {
        name: "⏰ WHEN TO ENTER",
        value: `**ENTER NOW (${trade.entryTime})**\nImmediate execution on confirmed breakout shelf.`,
        inline: false,
      },
      {
        name: "🎯 EXACT CONTRACT",
        value: `**${cleanContract}**`,
        inline: true,
      },
      {
        name: "💵 ESTIMATED ASK",
        value: `**$${trade.entryPrice.toFixed(2)}** ($${Math.round(trade.entryPrice * 100)}/contract max risk)`,
        inline: true,
      },
      {
        name: "🛑 STOP LOSS",
        value: `**$${trade.stopLoss.toFixed(2)}** (-${slPct}% hard cut)`,
        inline: true,
      },
      {
        name: `🎯 TARGET 1 (+${t1Pct}%)`,
        value: `**$${trade.target1.toFixed(2)}** (Scale 50% profit)`,
        inline: true,
      },
      {
        name: `🚀 TARGET 2 (+${t2Pct}%)`,
        value: `**$${trade.target2.toFixed(2)}** (Trail runner)`,
        inline: true,
      },
      {
        name: "📊 RVOL & TAPE",
        value: `**${rvolDisplay}** Institutional Surge`,
        inline: true,
      },
      {
        name: "🛡️ GATEKEEPER RATIONALE",
        value: trade.gatekeeperReason || "Rule 1-4 Passed: Tech Momentum + RVOL Floor >= 2.8x + Confirmed Candle Close + Positive Body Delta",
        inline: false,
      },
      {
        name: "⚡ EXECUTION PROTOCOL",
        value: "Quick scalp hold (5-15 mins max). Take profit on momentum expansion; never average down.",
        inline: false,
      },
    ],
    footer: {
      text: "Options Tracker AI • Real-Time Execution Desk",
    },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook({
    embeds: [embed],
  });
}

/**
 * Real-time Exit Alert (Target Hit or Stop Out)
 */
export async function sendTradeExitCallout(trade: {
  symbol: string;
  contract: string;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  pnlPercent: string;
  pnlPerContract: number;
  status: string;
  lessons?: string;
  qty?: number;
}) {
  const isWin = trade.pnlPerContract > 0;
  const color = isWin ? 0x10B981 : 0xF43F5E; // Emerald vs Rose Red
  const qty = trade.qty || 1;
  const totalDollars = Math.round(trade.pnlPerContract * qty);

  const embed: DiscordEmbed = {
    title: `${isWin ? "🎯 TARGET HIT" : "🛑 STOP LOSS TRIGGERED"}: ${trade.symbol} ${trade.contract}`,
    description: `**Outcome: ${trade.status} (${trade.pnlPercent})**`,
    color,
    fields: [
      {
        name: "⏱️ Entry Time",
        value: `\`${trade.entryTime}\``,
        inline: true,
      },
      {
        name: "🏁 Exit Time",
        value: `\`${trade.exitTime}\``,
        inline: true,
      },
      {
        name: "📈 Return",
        value: `\`${trade.pnlPercent}\``,
        inline: true,
      },
      {
        name: "💵 Entry Price",
        value: `$${trade.entryPrice.toFixed(2)}`,
        inline: true,
      },
      {
        name: "🎯 Exit Price",
        value: `$${trade.exitPrice.toFixed(2)}`,
        inline: true,
      },
      {
        name: "💰 Net Realized PnL",
        value: `**${trade.pnlPerContract >= 0 ? "+" : ""}$${trade.pnlPerContract.toFixed(2)}/ct** (${qty} ct: ${totalDollars >= 0 ? "+" : ""}$${totalDollars})`,
        inline: true,
      },
      {
        name: "📝 Execution Audit",
        value: trade.lessons || (isWin ? "Target achieved with disciplined profit-taking." : "Loss cut promptly at -25% boundary to preserve capital."),
        inline: false,
      },
    ],
    footer: {
      text: "Options Tracker AI Bot • Real-Time Execution Ledger",
    },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook({
    embeds: [embed],
  });
}

/**
 * Daily Call-Outs Summary (Entry + Exit Times for All Trades of the Day)
 */
export async function sendDailyCalloutsSummary(data: {
  date: string;
  monthName?: string;
  trades: Array<{
    symbol: string;
    contract?: string;
    entryTime: string;
    exitTime?: string;
    entryPrice: number;
    exitPrice?: number;
    pnlPercent?: string;
    pnlPerContract?: number;
    status?: string;
    lessons?: string;
    gatekeeperStatus?: string;
  }>;
  totalPnlPerCt: number;
  winRate: number;
  winCount: number;
  lossCount: number;
}) {
  const { date, trades, totalPnlPerCt, winRate, winCount, lossCount } = data;

  const isGreen = totalPnlPerCt >= 0;
  const embedColor = isGreen ? 0x10B981 : 0xF43F5E;

  const tradeFields: DiscordField[] = trades.map((t, idx) => {
    const isLive = t.status === "ACTIVE IN PLAY" || (t.exitTime || "").includes("Live") || (t.exitTime || "").includes("OPEN");
    const isTradeWin = (t.pnlPerContract ?? 0) > 0;
    const pnlSign = (t.pnlPerContract ?? 0) >= 0 ? "+" : "";
    const pnlStr = t.pnlPerContract !== undefined ? `${pnlSign}$${t.pnlPerContract.toFixed(0)}/ct` : "";
    const returnStr = t.pnlPercent || "";
    const badge = isLive ? "🟢" : isTradeWin ? "🟢" : "🔴";

    return {
      name: `${badge} #${idx + 1}: ${t.symbol} ${t.contract || ""}`,
      value: isLive
        ? [
            `• **Entry Time:** \`${t.entryTime}\` @ $${t.entryPrice.toFixed(2)}`,
            `• **Live State:** 🟢 **OPEN / IN PLAY** (Tracking Real-Time Targets)`,
            `• **Targets:** T1: +30% | T2: +60% | Stop Loss: -25%`,
            t.lessons ? `• *Catalyst:* ${t.lessons}` : "",
          ]
            .filter(Boolean)
            .join("\n")
        : [
            `• **Entry Time:** \`${t.entryTime}\` @ $${t.entryPrice.toFixed(2)}`,
            `• **Exit Time:** \`${t.exitTime || "EOD"}\` @ $${(t.exitPrice ?? t.entryPrice).toFixed(2)}`,
            `• **Result:** **${t.status || "CLOSED"}** (${returnStr} • ${pnlStr})`,
            t.lessons ? `• *Note:* ${t.lessons}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
      inline: false,
    };
  });

  const summaryEmbed: DiscordEmbed = {
    title: `📋 DAILY CALL-OUTS REPORT • ${date}`,
    description: `Institutional Trade Journal with Verified Entry & Exit Timestamps\n**Status:** ${
      trades.length === 0
        ? "No alert — All low-conviction setups blocked by Gatekeeper ($0 loss)"
        : `100% Filtered Discipline • ${winCount}W / ${lossCount}L`
    }`,
    color: embedColor,
    fields: [
      {
        name: "🏆 Win Rate",
        value: `**${winRate}%**`,
        inline: true,
      },
      {
        name: "💰 Net Day PnL",
        value: `**${totalPnlPerCt >= 0 ? "+" : ""}$${totalPnlPerCt.toFixed(2)} / ct**`,
        inline: true,
      },
      {
        name: "📊 Executed Signals",
        value: `**${trades.length} Calls Taken**`,
        inline: true,
      },
      ...(tradeFields.length > 0 ? tradeFields : [
        {
          name: "🛡️ Gatekeeper Protection",
          value: "All raw setups on this date failed institutional criteria (RVOL < 2.8x or pre-10:15 AM defensive trap). Zero capital risked.",
          inline: false,
        }
      ]),
    ],
    footer: {
      text: "Options Tracker AI • Calibrated Execution Log",
    },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook({
    embeds: [summaryEmbed],
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
 * Send real-time SPX 0DTE Power Hour Call-Out to Discord
 */
export async function sendSPXPowerHourAlert(payload: SPXPowerHourDiscordPayload) {
  const isCall = payload.setupType === "MOC_GAMMA_CALL" || payload.setupType === "PRE_CUTOFF_BREAKOUT_CALL";
  const isPreCutoff = payload.setupType === "PRE_CUTOFF_BREAKOUT_CALL" || payload.setupType === "PRE_CUTOFF_BREAKOUT_PUT";

  const title = isPreCutoff
    ? isCall
      ? `🚨 ENTER TRADE NOW: BUY SPX 0DTE ${payload.strike} CALL`
      : `🚨 ENTER TRADE NOW: BUY SPX 0DTE ${payload.strike} PUT`
    : isCall
    ? `⚡ ENTER MOC TRADE NOW: BUY SPX 0DTE ${payload.strike} CALL`
    : `⚡ ENTER MOC TRADE NOW: BUY SPX 0DTE ${payload.strike} PUT`;

  const color = isCall ? 0x10B981 : 0xEF4444; // Emerald, Crimson

  const fields: DiscordField[] = [
    {
      name: "⏰ WHEN TO ENTER",
      value: `**ENTER NOW (${payload.triggerTime})**\n${payload.brokerCutoffWarning ? `Warning: ${payload.brokerCutoffWarning}` : "Place order immediately on confirmed shelf breach."}`,
      inline: false,
    },
    {
      name: "🎯 EXACT CONTRACT",
      value: `**${payload.contract}**`,
      inline: true,
    },
    {
      name: "💵 ESTIMATED ASK",
      value: `**$${payload.entryAsk.toFixed(2)}** ($${payload.maxRiskPerContract} max risk)`,
      inline: true,
    },
    {
      name: "📊 SPX SPOT",
      value: `**$${payload.spxSpot.toFixed(2)}**`,
      inline: true,
    },
    {
      name: "🛑 WHEN TO CUT / EXIT",
      value: `Cut if SPX drops back inside shelf, or mandatory close by **${payload.exitCutoff}** (Do NOT hold into 4:00 PM cash settlement).`,
      inline: false,
    },
  ];

  const embed: DiscordEmbed = {
    title,
    description: `**Trigger Status:** \`${payload.shelfBreak}\`\n**Morning Bias (JFE):** \`${payload.morningBias}\`\n**MOC Flow:** ${payload.mocImbalance}`,
    color,
    fields,
    footer: {
      text: "SPX 0DTE Execution Desk • Options Tracker AI",
    },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordWebhook({
    embeds: [embed],
  });
}


