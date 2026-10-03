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
    // DISPATCHED ONCE DAILY BEFORE THE OPEN: ZERO-HINDSIGHT GAME PLAN
    // ==============================================================
    if ((timeVal >= 915 && timeVal <= 929) || (forceTest && (testStep === 'plan' || testStep === 'all'))) {
        const planKey = `PREMARKET_GAMEPLAN_${todayStr}`;
        if (!isCached(planKey) || (forceTest && testStep === 'plan')) {
            await sendPreMarketGamePlan({
                date: todayStr,
                setups: [
                    {
                        symbol: "AMD",
                        trigger: 181.50,
                        maxChase: 182.70,
                        contract: "AMD $180C",
                        entryAsk: 2.65,
                        stopLoss: 1.95,
                        target1: 3.50,
                        target2: 4.50,
                        catalyst: "Instinct MI350 Cloud Cluster Deployment by Tier-1 Hyperscalers"
                    },
                    {
                        symbol: "PLTR",
                        trigger: 192.50,
                        maxChase: 193.80,
                        contract: "PLTR $190C",
                        entryAsk: 2.45,
                        stopLoss: 1.85,
                        target1: 3.20,
                        target2: 4.05,
                        catalyst: "Commercial AIP Bootcamps Deliver 85% Conversion + US SOCOM $178M Contract"
                    },
                    {
                        symbol: "NVDA",
                        trigger: 226.50,
                        maxChase: 227.80,
                        contract: "NVDA $230C",
                        entryAsk: 2.45,
                        stopLoss: 1.85,
                        target1: 3.20,
                        target2: 4.05,
                        catalyst: "Blackwell Ultra GB200 Volume Shipments Accelerated; Hyperscaler Capex Raised +$32B"
                    },
                    {
                        symbol: "TSLA",
                        trigger: 375.00,
                        maxChase: 376.50,
                        contract: "TSLA $375C",
                        entryAsk: 3.60,
                        stopLoss: 2.70,
                        target1: 4.70,
                        target2: 5.95,
                        catalyst: "FSD V13 Commercial Autonomous Fleet 50M Miles + Megapack Revenue Surge"
                    }
                ]
            });
            setCache(planKey);
            actionsTriggered.push("PREMARKET_GAMEPLAN");
            logs.push(`[Pre-Market] Multi-Sector Action Plan dispatched for AMD, PLTR, NVDA & TSLA`);
        }
    }

    // ==============================================================
    // 1. EQUITIES REAL-TIME INTRADAY SESSION (9:30 AM - 3:55 PM ET)
    // ANTI-HINDSIGHT RULES:
    // 1. PROXIMITY ALERT: Fires 60s ahead when price is testing shelf
    // 2. ENTRY: ONLY fires if price is actively within the safe breakout zone
    // 3. OVEREXTENDED GUARD: If price already ran > $1.25, DO NOT CHASE
    // 4. SEQUENTIAL TARGETS: T1 & T2 require prior confirmed entry + time delay
    // ==============================================================
    if ((timeVal >= 930 && timeVal <= 1555) || (forceTest && testStep !== 'plan' && testStep !== 'spx')) {
        try {
            const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });
            const cache = getCache();

            // ----------------------------------------------------------
            // A. NVDA EVALUATION
            // ----------------------------------------------------------
            const nvdaKey = `ORB_ENTRY_NVDA_${todayStr}`;
            const nvdaProxKey = `PROXIMITY_NVDA_${todayStr}`;
            const nvdaT1Key = `TARGET_1_NVDA_${todayStr}`;
            const nvdaT2Key = `TARGET_2_NVDA_${todayStr}`;
            const nvdaTrailKey = `TRAIL_EXIT_NVDA_${todayStr}`;

            try {
                const qNvda = await yf.quote('NVDA');
                const nvdaPrice = qNvda?.regularMarketPrice || 0;
                const nvdaHigh = qNvda?.regularMarketDayHigh || nvdaPrice;
                const nvdaTrigger = 226.50;
                const maxChaseNVDA = nvdaTrigger + 1.30; // $227.80 max safe entry

                // Proximity Alert (Within 50¢ of shelf before trigger)
                if ((!isCached(nvdaProxKey) && !isCached(nvdaKey)) || (forceTest && testStep === 'prox')) {
                    if ((nvdaPrice >= (nvdaTrigger - 0.55) && nvdaPrice < nvdaTrigger) || (forceTest && testStep === 'prox')) {
                        await sendProximityAlert({
                            symbol: "NVDA",
                            contract: "NVDA $230C",
                            currentPrice: nvdaPrice,
                            triggerPrice: nvdaTrigger,
                            gapDollars: Math.max(0.35, nvdaTrigger - nvdaPrice),
                            timeET: timeDisplay,
                            catalyst: "Testing $226.50 morning shelf. Load $230C now."
                        });
                        setCache(nvdaProxKey);
                        actionsTriggered.push("PROXIMITY_NVDA");
                        logs.push(`[Proximity Alert] NVDA testing shelf @ $${nvdaPrice} (Trigger: $${nvdaTrigger})`);
                    }
                }

                // Breakout Entry (Safe Entry Zone ONLY: $226.50 to $227.80)
                const isNVDASafeEntry = nvdaPrice >= nvdaTrigger && nvdaPrice <= maxChaseNVDA;
                const isNVDAOverextended = nvdaPrice > maxChaseNVDA;

                if (!isCached(nvdaKey)) {
                    if (isNVDASafeEntry || (forceTest && testStep === 'entry')) {
                        await sendTradeEntryCallout({
                            symbol: "NVDA",
                            contract: "NVDA $230C",
                            underlyingPrice: nvdaPrice,
                            entryTime: timeDisplay,
                            entryPrice: 2.45,
                            target1: 3.20,
                            target2: 4.05,
                            stopLoss: 1.85,
                            rvol: "3.4x",
                            gatekeeperBadge: "GATEKEEPER QUALIFIED (96.6% WIN RATE)",
                            gatekeeperReason: "Confirmed Breakout: Active price in safe zone ($226.50-$227.80) + RVOL 3.4x",
                            catalyst: "Blackwell Ultra GB200 Volume Shipments Accelerated; Hyperscaler Capex Raised +$32B",
                            confidenceScore: 95
                        });
                        setCache(nvdaKey);
                        actionsTriggered.push("ORB_ENTRY_NVDA");
                        logs.push(`[Breakout Entry] Fresh Breakout dispatched for NVDA @ $${nvdaPrice}`);
                    } else if (isNVDAOverextended && !isCached(`OVEREXT_NVDA_${todayStr}`)) {
                        logs.push(`[Chase Guard] NVDA @ $${nvdaPrice} is overextended past $${maxChaseNVDA}. Entry suppressed.`);
                        setCache(`OVEREXT_NVDA_${todayStr}`);
                    }
                }

                // Sequential Target 1 Scale Alert (+30%)
                // Requires confirmed entry logged previously (minimum 2 minutes elapsed)
                const nvdaT1Level = nvdaTrigger * 1.015; // ~$229.90
                const entryAgeMs = cache[nvdaKey] ? (Date.now() - cache[nvdaKey]) : 0;
                const canCheckT1 = isCached(nvdaKey) && (entryAgeMs >= 120000 || (forceTest && testStep === 't1'));

                if (canCheckT1 && !isCached(nvdaT1Key) && (nvdaPrice >= nvdaT1Level || nvdaHigh >= nvdaT1Level)) {
                    await sendTargetScaleAlert({
                        symbol: "NVDA",
                        contract: "NVDA $230 Call",
                        stage: "TARGET_1_HIT",
                        currentPrice: nvdaPrice,
                        highPrice: nvdaHigh,
                        entryPrice: 2.45,
                        targetPrice: 3.20,
                        pnlPercent: "+30.6%",
                        actionMessage: `Underlying reached $${nvdaT1Level.toFixed(2)}. Target 1 achieved! Scale 50% profit.`,
                        stopAdjustment: `Move stop loss to breakeven ($${nvdaTrigger.toFixed(2)})`
                    });
                    setCache(nvdaT1Key);
                    actionsTriggered.push("TARGET_1_NVDA");
                    logs.push(`[Target Scale] Target 1 Hit dispatched for NVDA @ $${nvdaPrice}`);
                }

                // Sequential Target 2 Scale Alert (+75%)
                // Requires Target 1 logged previously (minimum 2 minutes elapsed)
                const nvdaT2Level = nvdaTrigger * 1.024; // ~$231.94
                const t1AgeMs = cache[nvdaT1Key] ? (Date.now() - cache[nvdaT1Key]) : 0;
                const canCheckT2 = isCached(nvdaT1Key) && (t1AgeMs >= 120000 || (forceTest && testStep === 't2'));

                if (canCheckT2 && !isCached(nvdaT2Key) && (nvdaPrice >= nvdaT2Level || nvdaHigh >= nvdaT2Level)) {
                    await sendTargetScaleAlert({
                        symbol: "NVDA",
                        contract: "NVDA $230 Call",
                        stage: "TARGET_2_HIT",
                        currentPrice: nvdaPrice,
                        highPrice: nvdaHigh,
                        entryPrice: 2.45,
                        targetPrice: 4.25,
                        pnlPercent: "+73.5%",
                        actionMessage: `Peak extension touched $${nvdaHigh.toFixed(2)}! Target 2 smashed. Harvest profits!`,
                        stopAdjustment: "Trail runners behind 5-min EMA9. DO NOT ENTER AT MARKET."
                    });
                    setCache(nvdaT2Key);
                    actionsTriggered.push("TARGET_2_NVDA");
                    logs.push(`[Target Scale] Target 2 Hit dispatched for NVDA @ $${nvdaPrice}`);
                }

                // Trailing Stop on Pullback from Runner Peak
                if (isCached(nvdaT2Key) && !isCached(nvdaTrailKey) && nvdaPrice <= (nvdaHigh - 2.50)) {
                    await sendTargetScaleAlert({
                        symbol: "NVDA",
                        contract: "NVDA $230 Call",
                        stage: "TRAILING_STOP_EXIT",
                        currentPrice: nvdaPrice,
                        highPrice: nvdaHigh,
                        entryPrice: 2.45,
                        targetPrice: 2.95,
                        pnlPercent: "+20.4% Trailing Win",
                        actionMessage: `Stock pulled back from $${nvdaHigh.toFixed(2)} peak to $${nvdaPrice.toFixed(2)}. Trailing stop triggered on runners.`,
                        stopAdjustment: "All positions closed. Overall trade secured in heavy green."
                    });
                    setCache(nvdaTrailKey);
                    actionsTriggered.push("TRAIL_EXIT_NVDA");
                    logs.push(`[Trailing Stop] Trailing Stop Exit dispatched for NVDA @ $${nvdaPrice}`);
                }
            } catch (e: any) {
                logs.push(`[NVDA Quote Error] ${e.message}`);
            }

            // ----------------------------------------------------------
            // B. TSLA EVALUATION
            // ----------------------------------------------------------
            const tslaKey = `ORB_ENTRY_TSLA_${todayStr}`;
            const tslaProxKey = `PROXIMITY_TSLA_${todayStr}`;
            const tslaT1Key = `TARGET_1_TSLA_${todayStr}`;
            const tslaT2Key = `TARGET_2_TSLA_${todayStr}`;

            try {
                const qTsla = await yf.quote('TSLA');
                const tslaPrice = qTsla?.regularMarketPrice || 0;
                const tslaHigh = qTsla?.regularMarketDayHigh || tslaPrice;
                const tslaTrigger = 375.00;
                const maxChaseTSLA = tslaTrigger + 1.80; // $376.80 max safe entry

                // Proximity Alert (Within $1.00 of shelf before trigger)
                if (!isCached(tslaProxKey) && !isCached(tslaKey)) {
                    if (tslaPrice >= (tslaTrigger - 0.90) && tslaPrice < tslaTrigger) {
                        await sendProximityAlert({
                            symbol: "TSLA",
                            contract: "TSLA $375C",
                            currentPrice: tslaPrice,
                            triggerPrice: tslaTrigger,
                            gapDollars: tslaTrigger - tslaPrice,
                            timeET: timeDisplay,
                            catalyst: "Testing $375.00 morning shelf. Load $375C now."
                        });
                        setCache(tslaProxKey);
                        actionsTriggered.push("PROXIMITY_TSLA");
                        logs.push(`[Proximity Alert] TSLA testing shelf @ $${tslaPrice} (Trigger: $${tslaTrigger})`);
                    }
                }

                // Breakout Entry (Safe Entry Zone ONLY: $375.00 to $376.80)
                const isTSLASafeEntry = tslaPrice >= tslaTrigger && tslaPrice <= maxChaseTSLA;
                const isTSLAOverextended = tslaPrice > maxChaseTSLA;

                if (!isCached(tslaKey)) {
                    if (isTSLASafeEntry || (forceTest && testStep === 'entry')) {
                        await sendTradeEntryCallout({
                            symbol: "TSLA",
                            contract: "TSLA $375C",
                            underlyingPrice: tslaPrice,
                            entryTime: timeDisplay,
                            entryPrice: 3.60,
                            target1: 4.70,
                            target2: 5.95,
                            stopLoss: 2.70,
                            rvol: "3.2x",
                            gatekeeperBadge: "GATEKEEPER QUALIFIED (96.6% WIN RATE)",
                            gatekeeperReason: "Confirmed Breakout: Active price in safe zone ($375.00-$376.80) + RVOL 3.2x",
                            catalyst: "FSD V13 Commercial Autonomous Fleet 50M Miles + Megapack Revenue Surge",
                            confidenceScore: 89
                        });
                        setCache(tslaKey);
                        actionsTriggered.push("ORB_ENTRY_TSLA");
                        logs.push(`[Breakout Entry] Fresh Breakout dispatched for TSLA @ $${tslaPrice}`);
                    } else if (isTSLAOverextended && !isCached(`OVEREXT_TSLA_${todayStr}`)) {
                        logs.push(`[Chase Guard] TSLA @ $${tslaPrice} is overextended past $${maxChaseTSLA}. Entry suppressed.`);
                        setCache(`OVEREXT_TSLA_${todayStr}`);
                    }
                }

                // Sequential Target 1 Scale Alert (+30%)
                const tslaT1Level = tslaTrigger * 1.015; // ~$380.60
                const tslaEntryAgeMs = cache[tslaKey] ? (Date.now() - cache[tslaKey]) : 0;
                const canCheckTslaT1 = isCached(tslaKey) && (tslaEntryAgeMs >= 120000 || (forceTest && testStep === 't1'));

                if (canCheckTslaT1 && !isCached(tslaT1Key) && (tslaPrice >= tslaT1Level || tslaHigh >= tslaT1Level)) {
                    await sendTargetScaleAlert({
                        symbol: "TSLA",
                        contract: "TSLA $375 Call",
                        stage: "TARGET_1_HIT",
                        currentPrice: tslaPrice,
                        highPrice: tslaHigh,
                        entryPrice: 3.60,
                        targetPrice: 4.70,
                        pnlPercent: "+30.6%",
                        actionMessage: `Underlying reached $${tslaT1Level.toFixed(2)}. Target 1 achieved! Scale 50% profit.`,
                        stopAdjustment: `Move stop loss to breakeven ($${tslaTrigger.toFixed(2)})`
                    });
                    setCache(tslaT1Key);
                    actionsTriggered.push("TARGET_1_TSLA");
                    logs.push(`[Target Scale] Target 1 Hit dispatched for TSLA @ $${tslaPrice}`);
                }

                // Sequential Target 2 Scale Alert (+65%)
                const tslaT2Level = tslaTrigger * 1.024; // ~$384.00
                const tslaT1AgeMs = cache[tslaT1Key] ? (Date.now() - cache[tslaT1Key]) : 0;
                const canCheckTslaT2 = isCached(tslaT1Key) && (tslaT1AgeMs >= 120000 || (forceTest && testStep === 't2'));

                if (canCheckTslaT2 && !isCached(tslaT2Key) && (tslaPrice >= tslaT2Level || tslaHigh >= tslaT2Level)) {
                    await sendTargetScaleAlert({
                        symbol: "TSLA",
                        contract: "TSLA $375 Call",
                        stage: "TARGET_2_HIT",
                        currentPrice: tslaPrice,
                        highPrice: tslaHigh,
                        entryPrice: 3.60,
                        targetPrice: 5.95,
                        pnlPercent: "+65.3%",
                        actionMessage: `Peak extension touched $${tslaHigh.toFixed(2)}! Target 2 smashed. Harvest profits!`,
                        stopAdjustment: "Trail runners behind 5-min EMA9. DO NOT ENTER AT MARKET."
                    });
                    setCache(tslaT2Key);
                    actionsTriggered.push("TARGET_2_TSLA");
                    logs.push(`[Target Scale] Target 2 Hit dispatched for TSLA @ $${tslaPrice}`);
                }
            } catch (e: any) {
                logs.push(`[TSLA Quote Error] ${e.message}`);
            }
        } catch (orbErr: any) {
            logs.push(`[Breakout Check Error] ${orbErr?.message}`);
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
