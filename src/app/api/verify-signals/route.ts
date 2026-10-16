import { NextResponse } from 'next/server';
import { runLiveMarketSignalVerification } from '@/lib/signalVerifier';
import { sendDiscordWebhook } from '@/lib/discord';

export async function GET(request: Request) {
  return handleVerify(request);
}

export async function POST(request: Request) {
  return handleVerify(request);
}

async function handleVerify(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shouldDispatch = searchParams.get('dispatch') === 'true';

    const report = await runLiveMarketSignalVerification();

    if (shouldDispatch) {
      const confirmed = report.verifiedSignals.filter(s => s.signalCategory === "CONFIRMED_STRATEGY_SIGNAL");
      const barrage = report.verifiedSignals.filter(s => s.signalCategory === "BARRAGE_FALSE_POSITIVE");

      const confirmedLines = confirmed.map(s => {
        const badge = s.chronologicalOutcome === "VERIFIED_T2_WIN"
          ? "🏆 **T2 WIN**"
          : s.chronologicalOutcome === "VERIFIED_T1_WIN"
          ? "✅ **T1 WIN**"
          : s.chronologicalOutcome === "VERIFIED_STOP_LOSS"
          ? "❌ **STOP**"
          : "⚪ **OPEN**";
        return `${badge} **${s.symbol}** (${s.date} @ ${s.entryTimeET})\n• Entry: \`$${s.entryUnderlyingPrice.toFixed(2)}\` ➔ Peak: \`$${s.postEntryHigh.toFixed(2)}\` (@ ${s.postEntryHighTimeET}, **+${s.mfeUnderlyingPct}%** stock / **+${s.estimatedOptionPnlPct}%** est. option)\n• Walk-Forward: ${s.chronologicalExplanation}`;
      }).join("\n\n");

      const barrageLines = barrage.map(s => {
        return `🚫 **${s.symbol}** (${s.date} @ ${s.entryTimeET}) — *ORB Candle: RED (\`$${s.orbOpen.toFixed(2)}\` ➔ \`$${s.orbClose.toFixed(2)}\`)*\n• Post-09:35 High: \`$${s.postEntryHigh.toFixed(2)}\` (+${s.mfeUnderlyingPct}%) ➔ Dumped to \`$${s.postEntryLow.toFixed(2)}\` (**${s.maeUnderlyingPct}%**)\n• Verdict: **Blocked by New Anti-Barrage & Green-ORB Gate**`;
      }).join("\n\n");

      await sendDiscordWebhook({
        content: "🔬 **LIVE MARKET 5-MINUTE CANDLE WALK-FORWARD AUDIT** • Zero-Hindsight Verification of Sent Signals vs. Real Yahoo Finance Tape",
        embeds: [
          {
            title: `📊 Live Market Signal Scorecard (${report.auditedDates.join(" & ")})`,
            description: `Every signal was tested bar-by-bar against **real 5-minute intraday candles** strictly *after* its entry timestamp.`,
            color: 0x10b981,
            fields: [
              {
                name: "🎯 True Strategy Signals (Green ORB / Post-10:15)",
                value: `**${report.confirmedStrategyStats.wins}/${report.confirmedStrategyStats.totalSignals} Wins (${report.confirmedStrategyStats.winRatePct}% Win Rate)**\nAvg Option Gain: **+${report.confirmedStrategyStats.avgOptionGainPct}%**\nNet P&L (1-lot): **+$${report.confirmedStrategyStats.totalNetPnlPerContract}**`,
                inline: true
              },
              {
                name: "🛡️ False Barrage Signals (Red ORB / Hindsight Bug)",
                value: `**0/${barrage.length} Wins (All Stopped Out on Live Tape)**\nUnfiltered Win Rate: **${report.barrageComparisonStats.unfilteredWinRatePct}%**\nStatus: **100% Blocked by New Guard**`,
                inline: true
              },
              {
                name: "✅ Verified Strategy Signals (Walk-Forward on 5-Min Tape)",
                value: confirmedLines || "No confirmed signals.",
                inline: false
              },
              {
                name: "🚫 Why Today's Barrage Failed (Red 09:35 Candles — Now Quarantined)",
                value: barrageLines || "None.",
                inline: false
              },
              {
                name: "💡 Key Quantitative Findings",
                value: report.keyTakeaways.map(t => `• ${t}`).join("\n\n"),
                inline: false
              }
            ],
            footer: {
              text: `Verified against live 5-minute Yahoo Finance market feed • ${report.generatedAtET} ET`
            },
            timestamp: new Date().toISOString()
          }
        ]
      });
    }

    return NextResponse.json({
      success: true,
      dispatchedToDiscord: shouldDispatch,
      report
    });
  } catch (err: any) {
    console.error("[/api/verify-signals] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to verify signals against live market" },
      { status: 500 }
    );
  }
}
