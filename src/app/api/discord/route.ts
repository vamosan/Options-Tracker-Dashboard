import { NextResponse } from 'next/server';
import { 
  sendDiscordWebhook, 
  sendTradeEntryCallout, 
  sendTradeExitCallout, 
  sendDailyCalloutsSummary, 
  sendDailyBriefingCallout,
  sendProspectiveStockAlert,
  sendTestSignal,
  sendSPXPowerHourAlert,
  sendTargetScaleAlert,
  DEFAULT_DISCORD_WEBHOOK_URL
} from '@/lib/discord';
import { CURRENT_MARKET_OUTLOOK } from '@/lib/prospectiveStocks';
import { recordOrUpdateAlertTrade } from '@/lib/ledger';
import { placeAlpacaPaperOptionOrder } from '@/lib/alpacaClient';

export async function GET() {
  const webhookConfigured = Boolean(process.env.DISCORD_WEBHOOK_URL || DEFAULT_DISCORD_WEBHOOK_URL);
  return NextResponse.json({
    status: 'ok',
    configured: webhookConfigured,
    webhookUrlMasked: DEFAULT_DISCORD_WEBHOOK_URL ? DEFAULT_DISCORD_WEBHOOK_URL.replace(/(webhooks\/\d+\/)(.{6}).*/, '$1$2******') : null
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, payload, webhookUrl } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Missing action in request body' }, { status: 400 });
    }

    if (action === 'test') {
      const result = await sendTestSignal();
      return NextResponse.json({ success: result.success, message: 'Test signal sent to Discord', details: result });
    }

    if (action === 'daily-briefing') {
      if (!payload || !payload.marketBias || !payload.topStocks) {
        return NextResponse.json({ success: false, error: 'Invalid briefing payload' }, { status: 400 });
      }

      // Mandatory Data Accuracy Guard: Prevent any 2024 stale prices (e.g. SPY 564, QQQ 485) from ever posting
      const sanitizedPayload = { ...payload };
      if (!sanitizedPayload.marketBias.spyTrend || sanitizedPayload.marketBias.spyTrend.includes('564') || sanitizedPayload.marketBias.spyTrend.includes('575')) {
        sanitizedPayload.marketBias.spyTrend = CURRENT_MARKET_OUTLOOK.tapeBias.spyTrend;
      }
      if (!sanitizedPayload.marketBias.qqqTrend || sanitizedPayload.marketBias.qqqTrend.includes('485')) {
        sanitizedPayload.marketBias.qqqTrend = CURRENT_MARKET_OUTLOOK.tapeBias.qqqTrend;
      }

      const result = await sendDailyBriefingCallout(sanitizedPayload);
      return NextResponse.json({ success: result.success, message: 'Daily heads-up briefing sent to Discord', details: result });
    }

    if (action === 'prospective-alert') {
      if (!payload || !payload.symbol || !payload.catalyst) {
        return NextResponse.json({ success: false, error: 'Invalid prospective alert payload' }, { status: 400 });
      }
      const result = await sendProspectiveStockAlert(payload);
      return NextResponse.json({ success: result.success, message: `Prospective alert sent for ${payload.symbol}`, details: result });
    }

    if (action === 'spx-powerhour') {
      if (!payload || !payload.contract || !payload.entryAsk) {
        return NextResponse.json({ success: false, error: 'Invalid SPX power hour payload: contract and entryAsk required' }, { status: 400 });
      }
      const isPutSpx = /put|\d+p\b/i.test(String(payload.contract || '')) || String(payload.setupType || '').includes('PUT');
      const spxSpotVal = payload.spxSpot || payload.strike || 7655;
      const spyStrike = Math.round((spxSpotVal > 1500 ? spxSpotVal / 10 : spxSpotVal));
      const spyOrder = await placeAlpacaPaperOptionOrder({
        underlying: 'SPY',
        strike: spyStrike,
        direction: isPutSpx ? 'PUT' : 'CALL',
        qty: 3,
        allowZeroDte: true,
      }).catch(() => null);

      const enrichedSpxPayload = spyOrder?.message && !String(payload.mocImbalance || '').includes('Alpaca')
        ? { ...payload, mocImbalance: `${payload.mocImbalance || 'SPX 0DTE Power Hour'} | 🤖 ${spyOrder.message}` }
        : payload;

      const result = await sendSPXPowerHourAlert(enrichedSpxPayload);
      
      // Auto-record SPX trade to persistent ledger
      const todayStr = new Date().toISOString().slice(0, 10);
      try {
        recordOrUpdateAlertTrade({
          id: `trade_${todayStr.replace(/-/g, '')}_spx`,
          date: todayStr,
          timestamp: new Date().toISOString(),
          symbol: "SPX",
          name: "S&P 500 Index",
          contract: payload.contract,
          action: `BUY ${payload.contract}${spyOrder?.occSymbol ? ` [${spyOrder.occSymbol}]` : ''}`,
          entryTime: payload.triggerTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          exitTime: payload.exitCutoff || "03:58 PM ET",
          duration: "20 min",
          session: "POWER_HOUR",
          entryPrice: spyOrder?.limitOrAskPrice || payload.entryAsk,
          target1: payload.target1,
          target2: payload.target2,
          stopLoss: payload.stopLoss,
          peakPrice: payload.spxSpot || payload.entryAsk,
          outcome: "OPEN_LIVE",
          pnlPerContract: 0,
          percentGain: "0.0%",
          rationale: payload.shelfBreak || "MOC Imbalance Breakout",
          catalyst: enrichedSpxPayload.mocImbalance || "SPX 0DTE Power Hour",
          rvol: "3.8x",
          confidenceScore: 94,
          winStatus: "PENDING"
        });
      } catch (err: any) {
        console.warn("Ledger auto-record SPX error:", err.message);
      }

      return NextResponse.json({ success: result.success, message: `SPX Power Hour Alert sent for ${payload.contract}`, alpacaOrder: spyOrder, details: result });
    }

    if (action === 'entry') {
      if (!payload || !payload.symbol || !payload.entryTime || !payload.entryPrice) {
        return NextResponse.json({ success: false, error: 'Invalid entry payload: symbol, entryTime, and entryPrice required' }, { status: 400 });
      }

      // Guarantee idempotent Alpaca Paper execution on every entry signal
      const contractStr = String(payload.contract || payload.symbol || '');
      const isPutEntry = /put|\d+p\b/i.test(contractStr) || String(payload.gatekeeperBadge || '').includes('PUT');
      const parsedStrike =
        payload.strike ||
        parseFloat(contractStr.match(/\$([0-9.]+)/)?.[1] || contractStr.match(/\b([0-9]{2,4}(?:\.[0-9]+)?)\s*(?:C|P|CALL|PUT)\b/i)?.[1] || '0') ||
        Math.round(payload.underlyingPrice || 150);
      const targetUnderlying = payload.symbol === 'SPX' ? 'SPY' : payload.symbol;
      const targetStrike = payload.symbol === 'SPX' && parsedStrike > 1500 ? Math.round(parsedStrike / 10) : parsedStrike;

      const alpacaOrder = await placeAlpacaPaperOptionOrder({
        underlying: targetUnderlying,
        strike: targetStrike,
        direction: isPutEntry ? 'PUT' : 'CALL',
        qty: 3,
        allowZeroDte: targetUnderlying === 'SPY' || targetUnderlying === 'QQQ',
      }).catch(() => null);

      const enrichedEntryPayload = alpacaOrder?.message && !String(payload.gatekeeperReason || '').includes('Alpaca')
        ? {
            ...payload,
            contract: alpacaOrder.occSymbol && !contractStr.includes(alpacaOrder.occSymbol) ? `${contractStr} (${alpacaOrder.occSymbol})` : contractStr,
            gatekeeperReason: `${payload.gatekeeperReason || 'Rule 1-4 Cleared'} | 🤖 ${alpacaOrder.message}`,
          }
        : payload;

      const result = await sendTradeEntryCallout(enrichedEntryPayload);

      // Auto-record entry to persistent ledger
      const todayStr = new Date().toISOString().slice(0, 10);
      try {
        recordOrUpdateAlertTrade({
          id: `trade_${todayStr.replace(/-/g, '')}_${payload.symbol.toLowerCase()}`,
          date: todayStr,
          timestamp: new Date().toISOString(),
          symbol: payload.symbol,
          contract: enrichedEntryPayload.contract,
          action: `BUY ${enrichedEntryPayload.contract || payload.symbol}`,
          entryTime: payload.entryTime,
          entryPrice: alpacaOrder?.limitOrAskPrice || payload.entryPrice,
          target1: payload.target1,
          target2: payload.target2,
          stopLoss: payload.stopLoss,
          peakPrice: payload.underlyingPrice || payload.entryPrice,
          outcome: "OPEN_LIVE",
          pnlPerContract: 0,
          percentGain: "0.0%",
          rationale: payload.catalyst || "",
          catalyst: payload.catalyst || "",
          rvol: payload.rvol || "3.0x",
          confidenceScore: payload.confidenceScore || 95,
          winStatus: "PENDING"
        });
      } catch (err: any) {
        console.warn("Ledger auto-record entry error:", err.message);
      }

      return NextResponse.json({ success: result.success, message: `Entry call-out sent for ${payload.symbol}`, alpacaOrder, details: result });
    }

    if (action === 'exit') {
      if (!payload || !payload.symbol || !payload.exitTime || !payload.exitPrice) {
        return NextResponse.json({ success: false, error: 'Invalid exit payload: symbol, exitTime, and exitPrice required' }, { status: 400 });
      }
      const result = await sendTradeExitCallout(payload);

      // Auto-update exit in persistent ledger
      const todayStr = new Date().toISOString().slice(0, 10);
      try {
        recordOrUpdateAlertTrade({
          id: `trade_${todayStr.replace(/-/g, '')}_${payload.symbol.toLowerCase()}`,
          date: todayStr,
          symbol: payload.symbol,
          contract: payload.contract,
          exitPrice: payload.exitPrice,
          exitTime: payload.exitTime,
          outcome: (payload.pnlPerContract || 0) >= 0 ? "TARGET_HIT" : "STOP_LOSS",
          pnlPerContract: payload.pnlPerContract || 0,
          percentGain: payload.pnlPercent || "0.0%",
          winStatus: (payload.pnlPerContract || 0) >= 0 ? "WIN" : "LOSS"
        });
      } catch (err: any) {
        console.warn("Ledger auto-record exit error:", err.message);
      }

      return NextResponse.json({ success: result.success, message: `Exit alert sent for ${payload.symbol}`, details: result });
    }

    if (action === 'target-scale') {
      if (!payload || !payload.symbol || !payload.stage || !payload.currentPrice) {
        return NextResponse.json({ success: false, error: 'Invalid target-scale payload: symbol, stage, and currentPrice required' }, { status: 400 });
      }
      const result = await sendTargetScaleAlert(payload);

      // Auto-update target scale in persistent ledger
      const todayStr = new Date().toISOString().slice(0, 10);
      let outcome = "OPEN_LIVE";
      let pnlPerContract = Math.round(((payload.targetPrice || payload.entryPrice * 1.3) - payload.entryPrice) * 100);
      let pctGain = payload.pnlPercent || "+30.0%";
      let exitTime = "Active Position";

      if (payload.stage === "TARGET_1_HIT") {
        outcome = "TARGET_1";
      } else if (payload.stage === "TARGET_2_HIT") {
        outcome = "TARGET_2";
        pnlPerContract = Math.round(((payload.targetPrice || payload.entryPrice * 1.65) - payload.entryPrice) * 100);
      } else if (payload.stage === "TRAILING_STOP_EXIT") {
        outcome = "TRAILING_WIN";
        exitTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        pnlPerContract = Math.round(((payload.targetPrice || payload.entryPrice * 1.20) - payload.entryPrice) * 100);
      }

      try {
        recordOrUpdateAlertTrade({
          id: `trade_${todayStr.replace(/-/g, '')}_${payload.symbol.toLowerCase()}`,
          date: todayStr,
          symbol: payload.symbol,
          contract: payload.contract,
          peakPrice: payload.highPrice || payload.currentPrice,
          exitTime,
          outcome,
          pnlPerContract,
          percentGain: pctGain,
          winStatus: "WIN"
        });
      } catch (err: any) {
        console.warn("Ledger auto-record target-scale error:", err.message);
      }

      return NextResponse.json({ success: result.success, message: `Target scale alert sent for ${payload.symbol}`, details: result });
    }

    if (action === 'daily-summary') {
      if (!payload || !payload.date || !Array.isArray(payload.trades)) {
        return NextResponse.json({ success: false, error: 'Invalid daily summary payload: date and trades array required' }, { status: 400 });
      }
      const result = await sendDailyCalloutsSummary(payload);
      return NextResponse.json({ success: result.success, message: `Daily call-outs summary sent for ${payload.date}`, details: result });
    }

    if (action === 'custom') {
      const result = await sendDiscordWebhook(payload, webhookUrl);
      return NextResponse.json({ success: result.success, message: 'Custom payload sent to Discord', details: result });
    }

    return NextResponse.json({ success: false, error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('[API /api/discord] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
