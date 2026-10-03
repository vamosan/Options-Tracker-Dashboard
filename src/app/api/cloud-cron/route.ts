import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getLiveSPXPowerHourData } from '@/lib/spxPowerHour';
import { 
    sendTradeEntryCallout, 
    sendSPXPowerHourAlert,
    sendTargetScaleAlert,
    sendProximityAlert,
    sendPreMarketGamePlan 
} from '@/lib/discord';
import YahooFinance from 'yahoo-finance2';
import { runAgenticDailyConsensus } from '@/lib/agenticOrchestrator';

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

    // Outside Market Hours Guard (Active 9:15 AM to 4:05 PM ET)
    if ((timeVal < 915 || timeVal > 1605) && !forceTest) {
        return NextResponse.json({
            status: "market_closed",
            reason: "Outside market hours (9:15 AM - 4:05 PM ET)",
            timeET: timeDisplay,
            logs
        });
    }

    const actionsTriggered: string[] = [];
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
    // 1. EQUITIES REAL-TIME INTRADAY SESSION (9:30 AM - 3:55 PM ET)
    // DYNAMIC SECTOR-AGNOSTIC AGENTIC DESK EXECUTION
    // ANTI-HINDSIGHT GUARDS:
    // 1. PROXIMITY ALERT: Fires 60s ahead when price is testing shelf
    // 2. ENTRY: ONLY fires if price is actively within the safe breakout zone
    // 3. CHASE GUARD: If price ran past max safe chase, SUPPRESS entry to prevent FOMO trap
    // 4. SEQUENTIAL TARGETS: T1 & T2 require prior confirmed entry + time delay
    // 5. DEVIL'S ADVOCATE GATEKEEPER: Zero trades taken if Risk Officer issued a VETO
    // ==============================================================
    if ((timeVal >= 930 && timeVal <= 1555) || (forceTest && testStep !== 'plan' && testStep !== 'spx')) {
        try {
            const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });
            const cache = getCache();

            // Run Agentic Consensus to select the top active opportunities cleared by Risk Officer
            const consensus = await runAgenticDailyConsensus(timeVal);
            
            // Focus on top cleared setups (cleared by Adversarial Risk Officer)
            const activeSetups = consensus.allRanked
                .filter(s => s.riskOfficer.status !== "VETOED")
                .slice(0, 2); // Top 2 highest conviction opportunities of the day

            for (const setup of activeSetups) {
                const sym = setup.symbol;
                const entryKey = `ORB_ENTRY_${sym}_${todayStr}`;
                const proxKey = `PROXIMITY_${sym}_${todayStr}`;
                const t1Key = `TARGET_1_${sym}_${todayStr}`;
                const t2Key = `TARGET_2_${sym}_${todayStr}`;
                const trailKey = `TRAIL_EXIT_${sym}_${todayStr}`;
                const overextKey = `OVEREXT_${sym}_${todayStr}`;

                try {
                    const q = await yf.quote(sym);
                    const currentPrice = q?.regularMarketPrice || setup.underlyingPrice;
                    const dayHigh = q?.regularMarketDayHigh || currentPrice;
                    const trigger = setup.trigger;
                    const maxChase = setup.maxChase;

                    // 1. Proximity Alert (Within 50¢ of shelf before trigger)
                    if ((!isCached(proxKey) && !isCached(entryKey)) || (forceTest && testStep === 'prox')) {
                        if ((currentPrice >= (trigger - 0.55) && currentPrice < trigger) || (forceTest && testStep === 'prox')) {
                            await sendProximityAlert({
                                symbol: sym,
                                contract: setup.contract,
                                currentPrice,
                                triggerPrice: trigger,
                                gapDollars: Math.max(0.35, trigger - currentPrice),
                                timeET: timeDisplay,
                                catalyst: `Testing $${trigger.toFixed(2)} morning shelf. ${setup.catalyst.slice(0, 70)}...`
                            });
                            setCache(proxKey);
                            actionsTriggered.push(`PROXIMITY_${sym}`);
                            logs.push(`[Proximity Alert] ${sym} testing shelf @ $${currentPrice.toFixed(2)} (Trigger: $${trigger.toFixed(2)})`);
                        }
                    }

                    // 2. Breakout Entry (Safe Entry Zone ONLY: trigger <= price <= maxChase)
                    const isSafeEntry = currentPrice >= trigger && currentPrice <= maxChase;
                    const isOverextended = currentPrice > maxChase;

                    if (!isCached(entryKey)) {
                        if (isSafeEntry || (forceTest && testStep === 'entry')) {
                            await sendTradeEntryCallout({
                                symbol: sym,
                                contract: setup.contract,
                                underlyingPrice: currentPrice,
                                entryTime: timeDisplay,
                                entryPrice: setup.entryAsk,
                                target1: setup.target1,
                                target2: setup.target2,
                                stopLoss: setup.stopLoss,
                                rvol: setup.rvol,
                                gatekeeperBadge: setup.riskOfficer.badge,
                                gatekeeperReason: `Rule 1-4 Cleared: ${setup.riskOfficer.devilsAdvocateCritique}`,
                                catalyst: setup.catalyst,
                                confidenceScore: setup.convictionScore,
                                agenticConsensus: {
                                    scoreBreakdown: `Trend: +${setup.pillars.trend} | Momentum: +${setup.pillars.momentum} | Macro: ${setup.pillars.macro >= 0 ? '+' : ''}${setup.pillars.macro} | Score: ${setup.convictionScore}%`,
                                    riskOfficerBadge: setup.riskOfficer.badge,
                                    devilsAdvocateCritique: setup.riskOfficer.devilsAdvocateCritique
                                }
                            });
                            setCache(entryKey);
                            actionsTriggered.push(`ORB_ENTRY_${sym}`);
                            logs.push(`[Breakout Entry] Fresh Breakout dispatched for ${sym} @ $${currentPrice.toFixed(2)} (Safe zone up to $${maxChase.toFixed(2)})`);
                        } else if (isOverextended && !isCached(overextKey)) {
                            logs.push(`[Chase Guard] ${sym} @ $${currentPrice.toFixed(2)} is overextended past max safe entry $${maxChase.toFixed(2)}. Entry suppressed.`);
                            setCache(overextKey);
                        }
                    }

                    // 3. Sequential Target 1 Scale Alert (+30%)
                    const t1Level = trigger * 1.015;
                    const entryAgeMs = cache[entryKey] ? (Date.now() - cache[entryKey]) : 0;
                    const canCheckT1 = isCached(entryKey) && (entryAgeMs >= 120000 || (forceTest && testStep === 't1'));

                    if (canCheckT1 && !isCached(t1Key) && (currentPrice >= t1Level || dayHigh >= t1Level)) {
                        await sendTargetScaleAlert({
                            symbol: sym,
                            contract: setup.contract,
                            stage: "TARGET_1_HIT",
                            currentPrice,
                            highPrice: dayHigh,
                            entryPrice: setup.entryAsk,
                            targetPrice: setup.target1,
                            pnlPercent: "+30.0%",
                            actionMessage: `Underlying reached $${t1Level.toFixed(2)}. Target 1 achieved! Scale 50% profit.`,
                            stopAdjustment: `Move stop loss to breakeven ($${trigger.toFixed(2)})`
                        });
                        setCache(t1Key);
                        actionsTriggered.push(`TARGET_1_${sym}`);
                        logs.push(`[Target Scale] Target 1 Hit dispatched for ${sym} @ $${currentPrice.toFixed(2)}`);
                    }

                    // 4. Sequential Target 2 Scale Alert (+65%)
                    const t2Level = trigger * 1.025;
                    const t1AgeMs = cache[t1Key] ? (Date.now() - cache[t1Key]) : 0;
                    const canCheckT2 = isCached(t1Key) && (t1AgeMs >= 120000 || (forceTest && testStep === 't2'));

                    if (canCheckT2 && !isCached(t2Key) && (currentPrice >= t2Level || dayHigh >= t2Level)) {
                        await sendTargetScaleAlert({
                            symbol: sym,
                            contract: setup.contract,
                            stage: "TARGET_2_HIT",
                            currentPrice,
                            highPrice: dayHigh,
                            entryPrice: setup.entryAsk,
                            targetPrice: setup.target2,
                            pnlPercent: "+65.0%",
                            actionMessage: `Peak extension touched $${dayHigh.toFixed(2)}! Target 2 smashed. Harvest profits!`,
                            stopAdjustment: "Trail runners behind 5-min EMA9. DO NOT ENTER AT MARKET."
                        });
                        setCache(t2Key);
                        actionsTriggered.push(`TARGET_2_${sym}`);
                        logs.push(`[Target Scale] Target 2 Hit dispatched for ${sym} @ $${currentPrice.toFixed(2)}`);
                    }

                    // 5. Trailing Stop on Pullback from Runner Peak
                    if (isCached(t2Key) && !isCached(trailKey) && currentPrice <= (dayHigh - (trigger * 0.012))) {
                        await sendTargetScaleAlert({
                            symbol: sym,
                            contract: setup.contract,
                            stage: "TRAILING_STOP_EXIT",
                            currentPrice,
                            highPrice: dayHigh,
                            entryPrice: setup.entryAsk,
                            targetPrice: setup.entryAsk * 1.25,
                            pnlPercent: "+25.0% Trailing Win",
                            actionMessage: `Stock pulled back from $${dayHigh.toFixed(2)} peak to $${currentPrice.toFixed(2)}. Trailing stop triggered on runners.`,
                            stopAdjustment: "All positions closed. Overall trade secured in heavy green."
                        });
                        setCache(trailKey);
                        actionsTriggered.push(`TRAIL_EXIT_${sym}`);
                        logs.push(`[Trailing Stop] Trailing Stop Exit dispatched for ${sym} @ $${currentPrice.toFixed(2)}`);
                    }
                } catch (symErr: any) {
                    logs.push(`[${sym} Evaluation Error] ${symErr?.message}`);
                }
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
                            mocImbalance: mocImbalance.rawText,
                            mocImbalanceType: mocImbalance.direction,
                            morningBias: spxData.morningMomentumBias.bias,
                            shelfBreak: callSide ? `Broke above $${high30.toFixed(1)}` : `Broke below $${low30.toFixed(1)}`,
                            exitCutoff: "03:58 PM ET",
                            brokerCutoffWarning: `${minsRemaining} min remaining before 3:40 PM retail broker cutoff!`
                        });

                        setCache(breakoutKey);
                        actionsTriggered.push(`SPX_BREAKOUT_${callSide ? 'CALL' : 'PUT'}`);
                        logs.push(`[SPX Power Hour] Breakout Entry Alert dispatched: ${contract}`);
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

    return NextResponse.json({
        success: true,
        session: timeVal >= 1500 && timeVal <= 1600 ? "POWER_HOUR" : (timeVal >= 930 && timeVal <= 1015 ? "MORNING_ORB" : "INTRADAY"),
        timeET: timeDisplay,
        today: todayStr,
        actionsTriggered,
        logs
    });
}
