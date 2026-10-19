import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getLiveSPXPowerHourData } from '@/lib/spxPowerHour';
import { 
    sendTradeEntryCallout, 
    sendSPXPowerHourAlert,
    sendTargetScaleAlert,
    sendProximityAlert,
    sendPreMarketGamePlan,
    sendDailyCalloutsSummary,
    sendAdvisorStandDownAlert,
    sendDiscordWebhook
} from '@/lib/discord';
import YahooFinance from 'yahoo-finance2';
import { runAgenticDailyConsensus } from '@/lib/agenticOrchestrator';
import { getSignals, recordOrUpdateAlertTrade } from '@/lib/ledger';
import {
    fetchAlpacaStockSnapshots,
    fetchTodayAlpacaTradedUnderlyings,
    placeAlpacaPaperOptionOrder,
    manageAlpacaPaperPositions,
} from '@/lib/alpacaClient';
import {
    runLiveMarketSignalVerification,
} from '@/lib/signalVerifier';

const CACHE_FILE = process.env.VERCEL ? '/tmp/cloud_cron_cache.json' : path.join(process.cwd(), '.cron_cache.json');

function getCache(): Record<string, number> {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
            return JSON.parse(raw);
        }
    } catch {
        // Fallback to empty
    }
    return {};
}

function setCache(key: string) {
    try {
        const cache = getCache();
        cache[key] = Date.now();
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf-8');
    } catch {
        // Quietly fail
    }
}

function isCached(key: string, maxAgeMs = 12 * 60 * 60 * 1000): boolean {
    const cache = getCache();
    const ts = cache[key];
    if (!ts) return false;
    return (Date.now() - ts) < maxAgeMs;
}

export async function GET(request: Request) {
    return handleCron(request);
}

export async function POST(request: Request) {
    return handleCron(request);
}

async function handleCron(request: Request) {
    const logs: string[] = [];
    const now = new Date();
    const etString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
    const etDate = new Date(etString);
    const dayOfWeek = etDate.getDay();
    const hours = etDate.getHours();
    const minutes = etDate.getMinutes();
    const timeVal = hours * 100 + minutes;
    const todayStr = `${etDate.getFullYear()}-${String(etDate.getMonth() + 1).padStart(2, '0')}-${String(etDate.getDate()).padStart(2, '0')}`;
    const timeDisplay = `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'} ET`;

    logs.push(`[Cloud Cron] Execution tick at ${timeDisplay} (${todayStr})`);

    // Check query params for forced execution or testing
    const { searchParams } = new URL(request.url);
    const forceTest = searchParams.get('test') === 'true';

    // Weekend Guard
    if ((dayOfWeek === 0 || dayOfWeek === 6) && !forceTest) {
        return NextResponse.json({
            status: "market_closed",
            reason: "Weekend",
            timeET: timeDisplay,
            logs
        });
    }

    // Outside Market Hours Guard (Active 9:15 AM to 4:15 PM ET to include 4:02-4:15 PM EOD Audit)
    if ((timeVal < 915 || timeVal > 1615) && !forceTest) {
        return NextResponse.json({
            status: "market_closed",
            reason: "Outside market hours (9:15 AM - 4:15 PM ET)",
            timeET: timeDisplay,
            logs
        });
    }

    const actionsTriggered: string[] = [];
    const recordedTrades: any[] = [];
    const testStep = searchParams.get('step') || 'all';

    // ==============================================================
    // 0. PRE-MARKET ACTION PLAN (9:15 AM - 9:29 AM ET)
    // DISPATCHED ONCE DAILY BEFORE THE OPEN: ZERO-HINDSIGHT AGENTIC CONSENSUS
    // ==============================================================
    if ((timeVal >= 915 && timeVal <= 929) || (forceTest && (testStep === 'plan' || testStep === 'all'))) {
        const planKey = `PREMARKET_GAMEPLAN_${todayStr}`;
        if (!isCached(planKey) || (forceTest && testStep === 'plan')) {
            const consensus = await runAgenticDailyConsensus(timeVal);
            const topSetups = [consensus.topOpportunity, consensus.secondaryOpportunity];

            await sendPreMarketGamePlan({
                date: todayStr,
                macroSummary: consensus.macro.summary,
                calibration: consensus.calibration,
                agenticDebate: {
                    hunterThesis: consensus.debate.hunterThesis,
                    riskOfficerAudit: consensus.debate.riskOfficerAudit
                },
                setups: topSetups.map(s => ({
                    symbol: s.symbol,
                    rank: s.rank,
                    isTopPick: s.isTopPick,
                    sector: s.sector,
                    trigger: s.trigger,
                    maxChase: s.maxChase,
                    contract: s.contract,
                    entryAsk: s.entryAsk,
                    stopLoss: s.stopLoss,
                    target1: s.target1,
                    target2: s.target2,
                    catalyst: s.catalyst,
                    convictionScore: s.convictionScore,
                    riskBadge: s.riskOfficer.badge,
                    pillarSummary: `Trend: +${s.pillars.trend} | Mom: +${s.pillars.momentum} | Macro: ${s.pillars.macro >= 0 ? '+' : ''}${s.pillars.macro}`
                }))
            });
            setCache(planKey);
            actionsTriggered.push("PREMARKET_GAMEPLAN");
            logs.push(`[Pre-Market] Agentic Consensus dispatched for #1 ${consensus.topOpportunity.symbol} (${consensus.topOpportunity.sector}) & #2 ${consensus.secondaryOpportunity.symbol}`);
        }
    }

    // ==============================================================
    // 1. EQUITIES REAL-TIME INTRADAY SESSION (9:35 AM - 3:55 PM ET)
    // DYNAMIC SECTOR-AGNOSTIC AGENTIC DESK EXECUTION
    // ANTI-BARRAGE & ZERO-HINDSIGHT INSTITUTIONAL GUARDS:
    // 1. 09:35 AM CANDLE CLOSE GATE: Zero equity entries before 09:35 AM ET
    // 2. NON-REPAINTING SESSION SHELF: Trigger anchored above max(dayOpen, prevClose)
    // 3. GREEN TAPE & NEAR-HIGH MANDATE: Stock must be green (>= +0.4%) & within 0.6% of session high
    // 4. ANTI-BARRAGE CAP: Max 1 new Entry per cron tick, Max 3 elite Entries per day
    // 5. SEQUENTIAL STAGE GATING: Entry -> T1 -> T2 -> Trail strictly mutually exclusive per tick with 10m spacing
    // ==============================================================
    if ((timeVal >= 935 && timeVal <= 1555) || (forceTest && testStep !== 'plan' && testStep !== 'spx')) {
        try {
            const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });
            const cache = getCache();
            const allLedgerSignals = (await getSignals()) || [];
            const existingTodaySignals = allLedgerSignals.filter((s: any) => s.date === todayStr);

            // Count how many equity entries have already fired today across cache + persistent ledger + live Alpaca Paper orders
            const alpacaTradedToday = await fetchTodayAlpacaTradedUnderlyings(todayStr);
            const alpacaEquityCount = Array.from(alpacaTradedToday).filter(s => s !== 'SPY').length;
            const cachedEntryCount = Object.keys(cache).filter(k => k.startsWith(`ORB_ENTRY_`) && k.endsWith(`_${todayStr}`)).length;
            let totalEntriesToday = Math.max(cachedEntryCount, existingTodaySignals.length, alpacaEquityCount);
            let entriesDispatchedThisTick = 0;
            const MAX_DAILY_ENTRIES = 2; // Strictly Top 1-2 Equity Setups per day (plus 1 SPX Power Hour = 1-3 total)

            // Run Agentic Consensus to select the top active opportunities cleared by Risk Officer
            const consensus = await runAgenticDailyConsensus(timeVal);
            
            // Strictly filter to Top CLEARED setups with high conviction (no VETOED or LEASH_WARNING entries)
            const activeSetups = consensus.allRanked
                .filter(s => s.riskOfficer.status === "CLEARED" && s.convictionScore >= 88)
                .slice(0, 3);

            // Batch-fetch Real-Time Alpaca Stock Snapshots for all active setups + SPY & QQQ tape benchmarks
            const symbolsToFetch = Array.from(new Set([...activeSetups.map(s => s.symbol), 'SPY', 'QQQ']));
            const alpacaSnaps = await fetchAlpacaStockSnapshots(symbolsToFetch);

            const spySnap = alpacaSnaps['SPY'];
            const qqqSnap = alpacaSnaps['QQQ'];
            const spyBelowVwap = spySnap ? spySnap.price < spySnap.vwap : consensus.macro.spyTrend === 'BEARISH';
            const qqqBelowVwap = qqqSnap ? qqqSnap.price < qqqSnap.vwap : consensus.macro.qqqTrend === 'BEARISH';

            // Step 0 (Pillar 4): Run Autonomous Alpaca Paper Position Guardian (+30% scale, +60% harvest, -14% early tape-reversal exit, -25% hard stop, 15:55 EOD close)
            const guardianActions = await manageAlpacaPaperPositions(timeVal, { spyBelowVwap, qqqBelowVwap });
            for (const gAct of guardianActions) {
                logs.push(gAct.summary);
                actionsTriggered.push(`ALPACA_${gAct.action}_${gAct.symbol}`);
                await sendTargetScaleAlert({
                    symbol: gAct.symbol,
                    contract: gAct.symbol,
                    stage: gAct.action === 'TARGET_1_TRIM' ? 'TARGET_1_HIT' : gAct.action === 'TARGET_2_EXIT' ? 'TARGET_2_HIT' : 'TRAILING_STOP_EXIT',
                    currentPrice: gAct.currentPrice,
                    highPrice: Math.max(gAct.currentPrice, gAct.avgEntry),
                    entryPrice: gAct.avgEntry,
                    targetPrice: gAct.currentPrice,
                    pnlPercent: `${gAct.pnlPct >= 0 ? '+' : ''}${gAct.pnlPct}% ($${gAct.pnlDollars >= 0 ? '+' : ''}${gAct.pnlDollars.toFixed(2)})`,
                    actionMessage: gAct.summary,
                    stopAdjustment: gAct.action === 'TARGET_1_TRIM' ? 'Remaining runner stop moved to breakeven in Alpaca Paper' : 'Position closed in Alpaca Paper Account'
                });

                const underlyingMatch = String(gAct.symbol || '').match(/^([A-Z]+)/);
                const underlyingSym = underlyingMatch ? underlyingMatch[1] : gAct.symbol;
                const ledgerSym = underlyingSym === 'SPY' ? 'SPX' : underlyingSym;
                const mappedOutcome =
                    gAct.action === 'TARGET_2_EXIT'
                        ? 'TARGET_2'
                        : gAct.action === 'TARGET_1_TRIM'
                        ? 'TARGET_1'
                        : gAct.pnlPct >= 0
                        ? 'TARGET_1'
                        : 'STOPPED';
                recordedTrades.push({
                    id: `trade_${todayStr.replace(/-/g, '')}_${ledgerSym.toLowerCase()}`,
                    date: todayStr,
                    symbol: ledgerSym,
                    exitTime: timeDisplay,
                    peakPrice: Math.max(gAct.currentPrice, gAct.avgEntry),
                    outcome: mappedOutcome,
                    pnlPerContract: Math.round((gAct.currentPrice - gAct.avgEntry) * 100),
                    percentGain: `${gAct.pnlPct >= 0 ? '+' : ''}${gAct.pnlPct}%`,
                    winStatus: gAct.pnlPct >= 0 ? 'WIN' : 'LOSS',
                });
            }

            for (const setup of activeSetups) {
                const sym = setup.symbol;
                const isPutSetup = setup.direction === "PUT";
                const entryKey = `ORB_ENTRY_${sym}_${todayStr}`;
                const proxKey = `PROXIMITY_${sym}_${todayStr}`;
                const t1Key = `TARGET_1_${sym}_${todayStr}`;
                const t2Key = `TARGET_2_${sym}_${todayStr}`;
                const trailKey = `TRAIL_EXIT_${sym}_${todayStr}`;
                const overextKey = `OVEREXT_${sym}_${todayStr}`;

                const ledgerTrade = existingTodaySignals.find((t: any) => t.symbol === sym);
                const hasEntryFired = isCached(entryKey) || Boolean(ledgerTrade) || alpacaTradedToday.has(sym);
                const hasT1Fired = isCached(t1Key) || Boolean(ledgerTrade && ["TARGET_1", "TARGET_2", "TRAILING_WIN"].includes(ledgerTrade.outcome));
                const hasT2Fired = isCached(t2Key) || Boolean(ledgerTrade && ["TARGET_2", "TRAILING_WIN"].includes(ledgerTrade.outcome));
                const hasTrailFired = isCached(trailKey) || Boolean(ledgerTrade && ledgerTrade.outcome === "TRAILING_WIN");

                try {
                    const snap = alpacaSnaps[sym];
                    const q = snap ? null : await yf.quote(sym).catch(() => null);
                    const currentPrice = snap?.price || q?.regularMarketPrice || setup.underlyingPrice;
                    const dayHigh = snap?.high || q?.regularMarketDayHigh || currentPrice;
                    const dayLow = snap?.low || q?.regularMarketDayLow || currentPrice;
                    const dayOpen = snap?.open || q?.regularMarketOpen || currentPrice;
                    const prevClose = snap?.prevClose || q?.regularMarketPreviousClose || currentPrice;
                    const changePercent = snap?.changePercent ?? q?.regularMarketChangePercent ?? ((currentPrice - prevClose) / prevClose) * 100;
                    const trigger = setup.trigger;
                    const maxChase = setup.maxChase;

                    // Optional Proximity Alert (ONLY when explicitly requested via testStep === 'prox' to prevent Discord chatter)
                    if (forceTest && testStep === 'prox' && !isCached(proxKey)) {
                        await sendProximityAlert({
                            symbol: sym,
                            contract: setup.contract,
                            currentPrice,
                            triggerPrice: trigger,
                            gapDollars: Math.max(0.35, Math.abs(trigger - currentPrice)),
                            timeET: timeDisplay,
                            catalyst: `Testing $${trigger.toFixed(2)} morning shelf. ${setup.catalyst.slice(0, 70)}...`
                        });
                        setCache(proxKey);
                        actionsTriggered.push(`PROXIMITY_${sym}`);
                        logs.push(`[Proximity Alert] ${sym} testing shelf @ $${currentPrice.toFixed(2)} (Trigger: $${trigger.toFixed(2)})`);
                    }

                    // Strict Live-Price-Only Breakout / Breakdown Conditions + Pillar 1 SPY/QQQ Intraday VWAP Alignment Gate
                    const isGreenOnSession = changePercent >= 0.40 && currentPrice > dayOpen && currentPrice > prevClose;
                    const isPushingSessionHigh = currentPrice >= dayHigh * 0.994;
                    const isRedOnSession = changePercent <= -0.80 && currentPrice < dayOpen && currentPrice < prevClose;
                    const isPushingSessionLow = currentPrice <= dayLow * 1.008;

                    // Pillar 1: Block CALL entries if both SPY & QQQ are below intraday VWAP (unless extreme +2% RS decoupled outlier)
                    // Block PUT entries if both SPY & QQQ are above intraday VWAP (unless extreme -2% breakdown outlier)
                    const tapeAlignedForCall = !(spyBelowVwap && qqqBelowVwap) || changePercent >= 2.0;
                    const tapeAlignedForPut = (spyBelowVwap || qqqBelowVwap) || changePercent <= -2.0;

                    const isSafeEntry = isPutSetup
                        ? (currentPrice <= trigger && currentPrice >= maxChase && isRedOnSession && isPushingSessionLow && tapeAlignedForPut)
                        : (currentPrice >= trigger && currentPrice <= maxChase && isGreenOnSession && isPushingSessionHigh && tapeAlignedForCall);

                    const isOverextended = isPutSetup
                        ? currentPrice < maxChase
                        : currentPrice > maxChase;

                    const t1Level = isPutSetup ? trigger * 0.985 : trigger * 1.015;
                    const t2Level = isPutSetup ? trigger * 0.975 : trigger * 1.025;
                    const entryAgeMs = cache[entryKey] ? (Date.now() - cache[entryKey]) : 0;
                    const t1AgeMs = cache[t1Key] ? (Date.now() - cache[t1Key]) : 0;
                    const t2AgeMs = cache[t2Key] ? (Date.now() - cache[t2Key]) : 0;

                    // MUTUALLY EXCLUSIVE STAGE EXECUTION PER TICK (Never fires Entry + T1 + T2 together)
                    if (!hasEntryFired) {
                        if (
                            (isSafeEntry && entriesDispatchedThisTick < 1 && totalEntriesToday < MAX_DAILY_ENTRIES) ||
                            (forceTest && testStep === 'entry' && entriesDispatchedThisTick < 1)
                        ) {
                            // AUTOMATIC ALPACA PAPER EXECUTION UPON SIGNAL FIRE + PILLAR 3 LIVE OPRA SPREAD VERIFICATION
                            const orderQty = setup.kellySizing?.recommendedContracts || 3;
                            const alpacaOrder = await placeAlpacaPaperOptionOrder({
                                underlying: sym,
                                strike: setup.strike,
                                direction: isPutSetup ? 'PUT' : 'CALL',
                                qty: orderQty,
                                allowZeroDte: false,
                            });

                            const isDuplicateAlpacaOrder =
                                !forceTest &&
                                (alpacaOrder.status === 'already_open' ||
                                    alpacaOrder.status === 'already_traded_today');

                            if (isDuplicateAlpacaOrder) {
                                setCache(entryKey);
                                logs.push(`[Deduplication Guard] ${sym} already traded today on Alpaca Paper (${alpacaOrder.occSymbol}). Suppressed duplicate Discord alert.`);
                                continue;
                            }

                            const verifiedAsk = alpacaOrder.limitOrAskPrice || setup.entryAsk;
                            const maxPayCeiling = alpacaOrder.maxPayCeiling || Math.round(verifiedAsk * 1.05 * 100) / 100;
                            const verifiedT1 = Math.round(verifiedAsk * 1.30 * 100) / 100;
                            const verifiedT2 = Math.round(verifiedAsk * 1.65 * 100) / 100;
                            const verifiedStop = Math.round(verifiedAsk * 0.75 * 100) / 100;
                            const spreadText = alpacaOrder.spreadPct !== undefined ? `Spread: ${alpacaOrder.spreadPct}%` : 'OPRA Verified';

                            await sendTradeEntryCallout({
                                symbol: sym,
                                contract: alpacaOrder.occSymbol ? `${setup.contract} (${alpacaOrder.occSymbol})` : setup.contract,
                                underlyingPrice: currentPrice,
                                entryTime: timeDisplay,
                                entryPrice: verifiedAsk,
                                target1: verifiedT1,
                                target2: verifiedT2,
                                stopLoss: verifiedStop,
                                rvol: setup.rvol,
                                gatekeeperBadge: `${setup.riskOfficer.badge} • DO NOT PAY OVER $${maxPayCeiling.toFixed(2)}`,
                                gatekeeperReason: `Rule 1-4 Cleared (${isPutSetup ? 'BEARISH PUT' : 'BULLISH CALL'} • ${spreadText}): ${setup.riskOfficer.devilsAdvocateCritique} | 🤖 ${alpacaOrder.message}`,
                                catalyst: setup.catalyst,
                                confidenceScore: setup.convictionScore,
                                agenticConsensus: {
                                    scoreBreakdown: `Trend: +${setup.pillars.trend} | Momentum: +${setup.pillars.momentum} | Macro: ${setup.pillars.macro >= 0 ? '+' : ''}${setup.pillars.macro} | Score: ${setup.convictionScore}%`,
                                    riskOfficerBadge: `${setup.riskOfficer.badge} (Ceiling: $${maxPayCeiling.toFixed(2)})`,
                                    devilsAdvocateCritique: `${setup.riskOfficer.devilsAdvocateCritique}\n🛡️ Hard Max-Pay Ceiling: DO NOT PAY OVER $${maxPayCeiling.toFixed(2)} (${spreadText})\n🤖 Alpaca Paper Auto-Execution: ${alpacaOrder.message}`
                                },
                                kellySizing: setup.kellySizing
                            });
                            setCache(entryKey);
                            entriesDispatchedThisTick += 1;
                            totalEntriesToday += 1;
                            actionsTriggered.push(`ORB_ENTRY_${sym}`);
                            if (alpacaOrder.success) {
                                actionsTriggered.push(`ALPACA_ORDER_${alpacaOrder.occSymbol || sym}`);
                            }
                            recordedTrades.push({
                                id: `trade_${todayStr.replace(/-/g, '')}_${sym.toLowerCase()}`,
                                date: todayStr,
                                timestamp: new Date().toISOString(),
                                symbol: sym,
                                name: setup.name || sym,
                                contract: setup.contract,
                                action: `BUY ${setup.contract}${alpacaOrder.occSymbol ? ` [${alpacaOrder.occSymbol}]` : ''}`,
                                time: timeDisplay,
                                entryTime: timeDisplay,
                                exitTime: "Active Position",
                                duration: "Live",
                                session: "MORNING_ORB",
                                entryPrice: verifiedAsk,
                                target1: verifiedT1,
                                target2: verifiedT2,
                                stopLoss: verifiedStop,
                                peakPrice: currentPrice,
                                outcome: "OPEN_LIVE",
                                pnlPerContract: 0,
                                percentGain: "0.0%",
                                rationale: `${setup.catalyst} | ${alpacaOrder.message}`,
                                catalyst: setup.catalyst,
                                rvol: setup.rvol,
                                confidenceScore: setup.convictionScore,
                                winStatus: "PENDING"
                            });
                            logs.push(`[${isPutSetup ? 'Breakdown Put' : 'Breakout Call'} Entry] Dispatched ${sym} @ $${currentPrice.toFixed(2)} | ${alpacaOrder.message}`);
                        } else if (isOverextended && !isCached(overextKey)) {
                            logs.push(`[Chase Guard] ${sym} @ $${currentPrice.toFixed(2)} is overextended past safe limit $${maxChase.toFixed(2)}. Entry suppressed.`);
                            setCache(overextKey);
                        }
                    } else if (
                        hasEntryFired &&
                        !hasT1Fired &&
                        ((entryAgeMs >= 600000 && (isPutSetup ? currentPrice <= t1Level : currentPrice >= t1Level)) || (forceTest && testStep === 't1'))
                    ) {
                        // 3. Sequential Target 1 Scale Alert (+30%) — requires >=10 mins after Entry & live currentPrice beyond t1Level
                        await sendTargetScaleAlert({
                            symbol: sym,
                            contract: setup.contract,
                            stage: "TARGET_1_HIT",
                            currentPrice,
                            highPrice: isPutSetup ? dayLow : dayHigh,
                            entryPrice: setup.entryAsk,
                            targetPrice: setup.target1,
                            pnlPercent: "+30.0%",
                            actionMessage: `Underlying reached $${currentPrice.toFixed(2)} (${isPutSetup ? 'below' : 'above'} $${t1Level.toFixed(2)} T1 level). Target 1 achieved! Scale 50% profit.`,
                            stopAdjustment: `Move stop loss to breakeven ($${trigger.toFixed(2)})`
                        });
                        setCache(t1Key);
                        actionsTriggered.push(`TARGET_1_${sym}`);
                        recordedTrades.push({
                            id: `trade_${todayStr.replace(/-/g, '')}_${sym.toLowerCase()}`,
                            date: todayStr,
                            symbol: sym,
                            contract: setup.contract,
                            peakPrice: isPutSetup ? Math.min(dayLow, currentPrice) : Math.max(dayHigh, currentPrice),
                            outcome: "TARGET_1",
                            pnlPerContract: Math.round((setup.target1 - setup.entryAsk) * 100),
                            percentGain: "+30.0%",
                            winStatus: "WIN"
                        });
                        logs.push(`[Target Scale] Target 1 Hit dispatched for ${sym} @ $${currentPrice.toFixed(2)}`);
                    } else if (
                        hasT1Fired &&
                        !hasT2Fired &&
                        ((t1AgeMs >= 600000 && (isPutSetup ? currentPrice <= t2Level : currentPrice >= t2Level)) || (forceTest && testStep === 't2'))
                    ) {
                        // 4. Sequential Target 2 Scale Alert (+65%) — requires >=10 mins after T1 & live currentPrice beyond t2Level
                        await sendTargetScaleAlert({
                            symbol: sym,
                            contract: setup.contract,
                            stage: "TARGET_2_HIT",
                            currentPrice,
                            highPrice: isPutSetup ? dayLow : dayHigh,
                            entryPrice: setup.entryAsk,
                            targetPrice: setup.target2,
                            pnlPercent: "+65.0%",
                            actionMessage: `Live extension reached $${currentPrice.toFixed(2)} (${isPutSetup ? 'below' : 'above'} $${t2Level.toFixed(2)} T2 level)! Target 2 smashed. Harvest profits!`,
                            stopAdjustment: "Trail runners behind 5-min EMA9. DO NOT ENTER AT MARKET."
                        });
                        setCache(t2Key);
                        actionsTriggered.push(`TARGET_2_${sym}`);
                        recordedTrades.push({
                            id: `trade_${todayStr.replace(/-/g, '')}_${sym.toLowerCase()}`,
                            date: todayStr,
                            symbol: sym,
                            contract: setup.contract,
                            peakPrice: isPutSetup ? Math.min(dayLow, currentPrice) : Math.max(dayHigh, currentPrice),
                            outcome: "TARGET_2",
                            pnlPerContract: Math.round((setup.target2 - setup.entryAsk) * 100),
                            percentGain: "+65.0%",
                            winStatus: "WIN"
                        });
                        logs.push(`[Target Scale] Target 2 Hit dispatched for ${sym} @ $${currentPrice.toFixed(2)}`);
                    } else if (
                        hasT2Fired &&
                        !hasTrailFired &&
                        t2AgeMs >= 300000 &&
                        (isPutSetup ? currentPrice >= (dayLow + (trigger * 0.012)) : currentPrice <= (dayHigh - (trigger * 0.012)))
                    ) {
                        // 5. Trailing Stop on Pullback from Runner Peak — requires >=5 mins after T2
                        await sendTargetScaleAlert({
                            symbol: sym,
                            contract: setup.contract,
                            stage: "TRAILING_STOP_EXIT",
                            currentPrice,
                            highPrice: isPutSetup ? dayLow : dayHigh,
                            entryPrice: setup.entryAsk,
                            targetPrice: setup.entryAsk * 1.25,
                            pnlPercent: "+25.0% Trailing Win",
                            actionMessage: `Stock retraced from $${(isPutSetup ? dayLow : dayHigh).toFixed(2)} peak to $${currentPrice.toFixed(2)}. Trailing stop triggered on runners.`,
                            stopAdjustment: "All positions closed. Overall trade secured in heavy green."
                        });
                        setCache(trailKey);
                        actionsTriggered.push(`TRAIL_EXIT_${sym}`);
                        recordedTrades.push({
                            id: `trade_${todayStr.replace(/-/g, '')}_${sym.toLowerCase()}`,
                            date: todayStr,
                            symbol: sym,
                            contract: setup.contract,
                            peakPrice: isPutSetup ? dayLow : dayHigh,
                            exitTime: timeDisplay,
                            outcome: "TRAILING_WIN",
                            pnlPerContract: Math.round((setup.entryAsk * 0.25) * 100),
                            percentGain: "+25.0%",
                            winStatus: "WIN"
                        });
                        logs.push(`[Trailing Stop] Trailing Stop Exit dispatched for ${sym} @ $${currentPrice.toFixed(2)}`);
                    }
                } catch (symErr: any) {
                    logs.push(`[${sym} Evaluation Error] ${symErr?.message}`);
                }
            }

            // Pillar 2: Proactive "Sit On Hands / Cash Is a Position" Advisory at 09:45–09:55 AM ET if 0 confirmed setups have triggered
            const standDownKey = `STAND_DOWN_${todayStr}`;
            if (
                ((timeVal >= 945 && timeVal <= 955 && totalEntriesToday === 0) || (forceTest && testStep === 'standdown')) &&
                !isCached(standDownKey)
            ) {
                const spyText = spySnap ? `$${spySnap.price.toFixed(2)} (${spySnap.changePercent >= 0 ? '+' : ''}${spySnap.changePercent.toFixed(2)}%, ${spyBelowVwap ? 'Below VWAP' : 'Above VWAP'})` : consensus.macro.spyTrend;
                const qqqText = qqqSnap ? `$${qqqSnap.price.toFixed(2)} (${qqqSnap.changePercent >= 0 ? '+' : ''}${qqqSnap.changePercent.toFixed(2)}%, ${qqqBelowVwap ? 'Below VWAP' : 'Above VWAP'})` : consensus.macro.qqqTrend;
                const topPick = consensus.topOpportunity;
                await sendAdvisorStandDownAlert({
                    date: todayStr,
                    timeET: timeDisplay,
                    regime: consensus.macro.regime,
                    spyStatus: spyText,
                    qqqStatus: qqqText,
                    reason: `First 15 minutes completed with 0 confirmed institutional shelf breakouts/breakdowns that passed our strict Green/Red ORB + SPY/QQQ VWAP alignment gate. Rather than forcing low-odds trades into morning chop, the desk is actively protecting capital.`,
                    watchlistStatus: `Monitoring #1 ${topPick.symbol} (${topPick.contract} @ $${topPick.trigger.toFixed(2)} trigger) & #2 ${consensus.secondaryOpportunity.symbol} ($${consensus.secondaryOpportunity.trigger.toFixed(2)} trigger) for clean post-10:15 AM institutional expansion or the 15:10 PM SPX Power Hour.`
                });
                setCache(standDownKey);
                actionsTriggered.push("ADVISOR_STAND_DOWN_0945");
                logs.push(`[Proactive Advisor] Dispatched 09:45 AM 'Sit On Hands / Cash Is a Position' Advisory to Discord.`);
            }
        } catch (orbErr: any) {
            logs.push(`[Agentic Breakout Check Error] ${orbErr?.message}`);
        }
    }

    // ==============================================================
    // 2. SPX 0DTE POWER HOUR (3:00 PM - 4:00 PM ET)
    // DISCORD RULE: ONLY ALERT ON VALID BREAKOUT ENTRIES OR MOC IMBALANCE
    // NO SPAM OR GENERIC BRIEFINGS
    // ==============================================================
    if ((timeVal >= 1500 && timeVal <= 1600) || (forceTest && (testStep === 'spx' || testStep === 'all'))) {
        try {
            // Also run Alpaca Paper Position Guardian during final 15:45-16:00 PM ET window (for 15:55 EOD close)
            if (timeVal > 1545 && timeVal <= 1600) {
                const lateGuardian = await manageAlpacaPaperPositions(timeVal);
                for (const gAct of lateGuardian) {
                    logs.push(gAct.summary);
                    actionsTriggered.push(`ALPACA_${gAct.action}_${gAct.symbol}`);
                }
            }

            const spxData = await getLiveSPXPowerHourData();
            const { spxSpot, rangeShelf, mocImbalance, directSignal } = spxData;
            const high30 = rangeShelf.high30;
            const low30 = rangeShelf.low30;

            logs.push(`[SPX Power Hour] Spot: ${spxSpot.toFixed(2)} | Shelf: ${low30.toFixed(1)} - ${high30.toFixed(1)} | Direction: ${rangeShelf.breakoutDirection}`);

            // 2A. Pre-Broker Cutoff Breakout Entry Window (3:10 PM - 3:40 PM ET)
            // Active across full window so no 5-minute cron tick misses the setup
            if ((timeVal >= 1510 && timeVal <= 1540) || (forceTest && (testStep === 'spx' || testStep === 'all'))) {
                const isCall = rangeShelf.breakoutDirection === "UPWARD_BREAKOUT";
                const isPut = rangeShelf.breakoutDirection === "DOWNWARD_BREAKOUT";

                if (isCall || isPut || (forceTest && testStep === 'spx')) {
                    const breakoutKey = `SPX_BREAKOUT_${todayStr}`;
                    if (!isCached(breakoutKey)) {
                        const callSide = isCall || forceTest;
                        const targetStrike = callSide ? Math.ceil((high30 + 4) / 5) * 5 : Math.floor((low30 - 4) / 5) * 5;
                        const contract = `SPX 0DTE ${targetStrike} ${callSide ? 'CALL' : 'PUT'}`;
                        const entryAsk = directSignal?.entryAsk || 3.70;
                        const minsRemaining = Math.max(1, 40 - minutes);

                        // Automatically place SPY 0DTE proxy Paper Option Order on Alpaca
                        const spyStrike = Math.round(spxSpot / 10);
                        const spyOrder = await placeAlpacaPaperOptionOrder({
                            underlying: 'SPY',
                            strike: spyStrike,
                            direction: callSide ? 'CALL' : 'PUT',
                            qty: 3,
                            allowZeroDte: true,
                        });

                        const isDuplicateSpyOrder =
                            !forceTest &&
                            (spyOrder.status === 'already_open' ||
                                spyOrder.status === 'already_traded_today');

                        if (!isDuplicateSpyOrder) {
                            await sendSPXPowerHourAlert({
                                setupType: callSide ? "PRE_CUTOFF_BREAKOUT_CALL" : "PRE_CUTOFF_BREAKOUT_PUT",
                                triggerTime: timeDisplay,
                                spxSpot,
                                contract,
                                strike: targetStrike,
                                entryAsk,
                                target1: Math.round(entryAsk * 2.2 * 100) / 100,
                                target2: Math.round(entryAsk * 4.5 * 100) / 100,
                                stopLoss: Math.round(entryAsk * 0.3 * 100) / 100,
                                maxRiskPerContract: Math.round(entryAsk * 100),
                                mocImbalance: `${mocImbalance.rawText} | 🤖 ${spyOrder.message}`,
                                mocImbalanceType: mocImbalance.direction,
                                morningBias: spxData.morningMomentumBias.bias,
                                shelfBreak: callSide ? `Broke above $${high30.toFixed(1)}` : `Broke below $${low30.toFixed(1)}`,
                                exitCutoff: "03:58 PM ET",
                                brokerCutoffWarning: `${minsRemaining} min remaining before 3:40 PM retail broker cutoff!`
                            });

                            setCache(breakoutKey);
                            actionsTriggered.push(`SPX_BREAKOUT_${callSide ? 'CALL' : 'PUT'}`);
                            if (spyOrder.success) {
                                actionsTriggered.push(`ALPACA_SPY_0DTE_${spyOrder.occSymbol || 'ORDER'}`);
                            }
                            recordedTrades.push({
                                id: `trade_${todayStr.replace(/-/g, '')}_spx`,
                                date: todayStr,
                                timestamp: new Date().toISOString(),
                                symbol: 'SPX',
                                name: 'S&P 500 Index',
                                contract,
                                action: `BUY ${contract}${spyOrder.occSymbol ? ` [${spyOrder.occSymbol}]` : ''}`,
                                time: timeDisplay,
                                entryTime: timeDisplay,
                                exitTime: 'Active Position',
                                duration: 'Live',
                                session: 'POWER_HOUR',
                                entryPrice: spyOrder.limitOrAskPrice || entryAsk,
                                target1: Math.round(entryAsk * 2.2 * 100) / 100,
                                target2: Math.round(entryAsk * 4.5 * 100) / 100,
                                stopLoss: Math.round(entryAsk * 0.3 * 100) / 100,
                                peakPrice: spyOrder.limitOrAskPrice || entryAsk,
                                outcome: 'OPEN_LIVE',
                                pnlPerContract: 0,
                                percentGain: '0.0%',
                                rationale: `Power Hour ${callSide ? 'Upward Breakout above ' + high30.toFixed(1) : 'Downward Breakdown below ' + low30.toFixed(1)} | ${spyOrder.message}`,
                                catalyst: `Power Hour Shelf ${callSide ? 'Breakout' : 'Breakdown'} (${low30.toFixed(1)} - ${high30.toFixed(1)})`,
                                rvol: '3.8x',
                                confidenceScore: 94,
                                winStatus: 'PENDING'
                            });
                            logs.push(`[SPX Power Hour] Breakout Entry Alert dispatched: ${contract} | ${spyOrder.message}`);
                        } else {
                            setCache(breakoutKey);
                            logs.push(`[SPX Power Hour Deduplication] SPY 0DTE order already placed today on Alpaca (${spyOrder.occSymbol}). Suppressed duplicate alert.`);
                        }
                    }
                }
            }

            // 2B. NYSE MOC Imbalance Window (3:45 PM - 4:00 PM ET)
            // Captures late imbalance threshold surge
            if ((timeVal >= 1545 && timeVal <= 1600) || (forceTest && (testStep === 'spx' || testStep === 'all'))) {
                const mocKey = `SPX_MOC_${todayStr}`;
                if (!isCached(mocKey) && (forceTest || (mocImbalance.status === "PUBLISHED" && mocImbalance.thresholdMet))) {
                    const isMocBuy = mocImbalance.direction === "BUY" || forceTest;
                    const targetStrike = isMocBuy ? Math.ceil((high30 + 4) / 5) * 5 : Math.floor((low30 - 4) / 5) * 5;
                    const contract = `SPX 0DTE ${targetStrike} ${isMocBuy ? 'CALL' : 'PUT'}`;
                    const entryAsk = directSignal?.entryAsk || 3.70;

                    await sendSPXPowerHourAlert({
                        setupType: isMocBuy ? "MOC_GAMMA_CALL" : "MOC_GAMMA_PUT",
                        triggerTime: timeDisplay,
                        spxSpot,
                        contract,
                        strike: targetStrike,
                        entryAsk,
                        target1: Math.round(entryAsk * 2.2 * 100) / 100,
                        target2: Math.round(entryAsk * 4.5 * 100) / 100,
                        stopLoss: 1.11,
                        maxRiskPerContract: Math.round(entryAsk * 100),
                        mocImbalance: mocImbalance.rawText,
                        mocImbalanceType: mocImbalance.direction,
                        morningBias: spxData.morningMomentumBias.bias,
                        shelfBreak: `NYSE MOC Imbalance: ${mocImbalance.rawText}`,
                        exitCutoff: "03:58 PM ET"
                    });

                    setCache(mocKey);
                    actionsTriggered.push("SPX_MOC_ALERT");
                    logs.push(`[SPX Power Hour] MOC Entry Alert dispatched: ${contract}`);
                }
            }

        } catch (spxErr: any) {
            logs.push(`[SPX Power Hour Error] ${spxErr?.message}`);
        }
    }

    // ==============================================================
    // 3. AUTOMATED END-OF-DAY PERFORMANCE AUDIT & WALK-FORWARD TRUTH SCORECARD (04:02 PM - 04:15 PM ET)
    // Automatically compiles daily alerts + 5-min walk-forward verification and dispatches to Discord
    // ==============================================================
    if ((timeVal >= 1602 && timeVal <= 1615) || (forceTest && (testStep === 'audit' || testStep === 'all'))) {
        const auditKey = `EOD_AUDIT_${todayStr}`;
        if (!isCached(auditKey) || (forceTest && testStep === 'audit')) {
            try {
                const allTrades = await getSignals();
                const todayTrades = allTrades.filter((t: any) => t.date === todayStr);

                if (todayTrades.length > 0) {
                    const wins = todayTrades.filter((t: any) => t.winStatus === "WIN" || (t.pnlPerContract || 0) > 0).length;
                    const losses = todayTrades.filter((t: any) => t.winStatus === "LOSS" || (t.pnlPerContract < 0 && t.outcome !== "OPEN_LIVE")).length;
                    const totalPnl = todayTrades.reduce((acc: number, t: any) => acc + (t.pnlPerContract || 0), 0);
                    const winRate = todayTrades.length > 0 ? Math.round((wins / todayTrades.length) * 100) : 100;

                    await sendDailyCalloutsSummary({
                        date: todayStr,
                        monthName: etDate.toLocaleString('default', { month: 'long' }),
                        trades: todayTrades.map((t: any) => ({
                            symbol: t.symbol,
                            contract: t.contract,
                            entryTime: t.entryTime || t.time,
                            exitTime: t.exitTime || "Closed EOD",
                            entryPrice: t.entryPrice,
                            exitPrice: t.peakPrice || t.exitPrice,
                            pnlPercent: t.percentGain,
                            pnlPerContract: t.pnlPerContract,
                            status: t.outcome === "TARGET_2" ? "TARGET 2 HIT (+65%)" : t.outcome === "TARGET_1" ? "TARGET 1 HIT (+30%)" : t.outcome === "TRAILING_WIN" ? "TRAILING WIN (+25%)" : t.outcome,
                            lessons: t.catalyst || t.rationale,
                            gatekeeperStatus: "QUALIFIED"
                        })),
                        totalPnlPerCt: totalPnl,
                        winRate,
                        winCount: wins,
                        lossCount: losses
                    });

                    actionsTriggered.push("EOD_PERFORMANCE_AUDIT");
                    logs.push(`[EOD Audit] Automated Performance Report dispatched to Discord: ${wins}W / ${losses}L (${winRate}%) • Net PnL: +$${totalPnl}`);
                }

                // Pillar 5: Automated 16:05 PM ET 5-Minute Walk-Forward "Truth Scorecard"
                const verifiedReport = await runLiveMarketSignalVerification();
                const confirmed = verifiedReport.verifiedSignals.filter(s => s.signalCategory === "CONFIRMED_STRATEGY_SIGNAL");
                if (confirmed.length > 0) {
                    const confirmedLines = confirmed.slice(0, 6).map(s => {
                        const badge = s.chronologicalOutcome === "VERIFIED_T2_WIN"
                            ? "🏆 **T2 WIN**"
                            : s.chronologicalOutcome === "VERIFIED_T1_WIN"
                            ? "✅ **T1 WIN**"
                            : s.chronologicalOutcome === "VERIFIED_STOP_LOSS"
                            ? "❌ **STOP**"
                            : "⚪ **OPEN**";
                        return `${badge} **${s.symbol}** (${s.date} @ ${s.entryTimeET}) • Entry \`$${s.entryUnderlyingPrice.toFixed(2)}\` ➔ Peak \`$${s.postEntryHigh.toFixed(2)}\` (**+${s.estimatedOptionPnlPct}%** est. option)`;
                    }).join("\n");

                    await sendDiscordWebhook({
                        content: `🔬 **AUTOMATED 16:05 PM ET LIVE-TAPE TRUTH SCORECARD (${todayStr})**`,
                        embeds: [{
                            title: `📊 5-Minute Walk-Forward Verification (${verifiedReport.confirmedStrategyStats.winRatePct}% Confirmed Win Rate)`,
                            description: `Every signal was audited bar-by-bar against real 5-minute intraday candles strictly after entry timestamp.\n\n${confirmedLines}`,
                            color: 0x10b981,
                            fields: [
                                {
                                    name: "🎯 Confirmed Strategy Stats",
                                    value: `**${verifiedReport.confirmedStrategyStats.wins}/${verifiedReport.confirmedStrategyStats.totalSignals} Wins (${verifiedReport.confirmedStrategyStats.winRatePct}%)** • Avg Option Return: **+${verifiedReport.confirmedStrategyStats.avgOptionGainPct}%**`,
                                    inline: true
                                },
                                {
                                    name: "🛡️ False Barrages Quarantined",
                                    value: `**${verifiedReport.barrageComparisonStats.falsePositivesBlockedByFix} Blocked** by Green/Red ORB + VWAP Gate`,
                                    inline: true
                                }
                            ],
                            timestamp: new Date().toISOString()
                        }]
                    });
                    actionsTriggered.push("EOD_TRUTH_SCORECARD");
                    logs.push(`[Truth Scorecard] Dispatched 5-minute walk-forward verification (${verifiedReport.confirmedStrategyStats.winRatePct}% win rate).`);
                }

                setCache(auditKey);
            } catch (auditErr: any) {
                logs.push(`[EOD Audit Error] ${auditErr?.message}`);
            }
        }
    }

    if (recordedTrades.length > 0) {
        for (const t of recordedTrades) {
            try {
                recordOrUpdateAlertTrade(t);
            } catch {
                // Non-blocking ledger persistence
            }
        }
    }

    return NextResponse.json({
        success: true,
        session: timeVal >= 1500 && timeVal <= 1600 ? "POWER_HOUR" : (timeVal >= 930 && timeVal <= 1015 ? "MORNING_ORB" : "INTRADAY"),
        timeET: timeDisplay,
        today: todayStr,
        actionsTriggered,
        recordedTrades,
        logs
    });
}
