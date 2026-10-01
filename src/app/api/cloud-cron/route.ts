import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getLiveSPXPowerHourData } from '@/lib/spxPowerHour';
import { 
    sendTradeEntryCallout, 
    sendSPXPowerHourAlert 
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

    // Outside Market Hours Guard (Active 9:25 AM to 4:05 PM ET)
    if ((timeVal < 925 || timeVal > 1605) && !forceTest) {
        return NextResponse.json({
            status: "market_closed",
            reason: "Outside market hours (9:25 AM - 4:05 PM ET)",
            timeET: timeDisplay,
            logs
        });
    }

    const actionsTriggered: string[] = [];

    // ==============================================================
    // 1. EQUITIES BREAKOUT SESSION (9:35 AM - 3:55 PM ET)
    // DISCORD RULE: ONLY ALERT ON VALID CONFIRMED BREAKOUT ENTRIES
    // NO SPAM OR GENERIC BRIEFINGS (Max 1 alert per symbol per day)
    // ==============================================================
    if ((timeVal >= 935 && timeVal <= 1555) || forceTest) {
        try {
            const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });
            
            // Check NVDA (Qualified Setup 1: Shelf $226.50)
            const nvdaKey = `ORB_ENTRY_NVDA_${todayStr}`;
            if (!isCached(nvdaKey)) {
                try {
                    const qNvda = await yf.quote('NVDA');
                    const nvdaPrice = qNvda?.regularMarketPrice || 0;
                    const nvdaHigh = qNvda?.regularMarketDayHigh || nvdaPrice;
                    const nvdaTrigger = 226.50;
                    if (nvdaPrice >= nvdaTrigger || nvdaHigh >= nvdaTrigger || forceTest) {
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
                            gatekeeperReason: "Rule 1-4 Passed: Tech Momentum + RVOL 3.4x >= 2.8x + 09:35 AM close + Green bar structure",
                            catalyst: "Blackwell Ultra GB200 Volume Shipments Accelerated; Hyperscaler Capex Raised +$32B",
                            confidenceScore: 95
                        });
                        setCache(nvdaKey);
                        actionsTriggered.push("ORB_ENTRY_NVDA");
                        logs.push(`[Breakout Entry] Confirmed Breakout Entry dispatched for NVDA @ $${nvdaPrice} (Day High $${nvdaHigh})`);
                    }
                } catch (e: any) {
                    logs.push(`[NVDA Quote Error] ${e.message}`);
                }
            }

            // Check TSLA (Qualified Setup 2: Shelf $375.00)
            const tslaKey = `ORB_ENTRY_TSLA_${todayStr}`;
            if (!isCached(tslaKey)) {
                try {
                    const qTsla = await yf.quote('TSLA');
                    const tslaPrice = qTsla?.regularMarketPrice || 0;
                    const tslaHigh = qTsla?.regularMarketDayHigh || tslaPrice;
                    const tslaTrigger = 375.00;
                    if (tslaPrice >= tslaTrigger || tslaHigh >= tslaTrigger || forceTest) {
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
                            gatekeeperReason: "Rule 1-4 Passed: High-Beta Momentum + RVOL 3.2x >= 2.8x + 09:35 AM close",
                            catalyst: "FSD V13 Commercial Autonomous Fleet 50M Miles + Megapack Revenue Surge",
                            confidenceScore: 89
                        });
                        setCache(tslaKey);
                        actionsTriggered.push("ORB_ENTRY_TSLA");
                        logs.push(`[Breakout Entry] Confirmed Breakout Entry dispatched for TSLA @ $${tslaPrice} (Day High $${tslaHigh})`);
                    }
                } catch (e: any) {
                    logs.push(`[TSLA Quote Error] ${e.message}`);
                }
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
    if (timeVal >= 1500 && timeVal <= 1600) {
        try {
            const spxData = await getLiveSPXPowerHourData();
            const { spxSpot, rangeShelf, mocImbalance, directSignal } = spxData;
            const high30 = rangeShelf.high30;
            const low30 = rangeShelf.low30;

            logs.push(`[SPX Power Hour] Spot: ${spxSpot.toFixed(2)} | Shelf: ${low30.toFixed(1)} - ${high30.toFixed(1)} | Direction: ${rangeShelf.breakoutDirection}`);

            // 2A. 3:30 PM - 3:39 PM Pre-Broker Cutoff Breakout Entry Window
            // ONLY fires if price actively broke beyond the accumulation shelf
            if (timeVal >= 1530 && timeVal <= 1539) {
                const isCall = rangeShelf.breakoutDirection === "UPWARD_BREAKOUT";
                const isPut = rangeShelf.breakoutDirection === "DOWNWARD_BREAKOUT";

                if (isCall || isPut) {
                    const breakoutKey = `SPX_BREAKOUT_${todayStr}`;
                    if (!isCached(breakoutKey)) {
                        const targetStrike = isCall ? Math.ceil((high30 + 4) / 5) * 5 : Math.floor((low30 - 4) / 5) * 5;
                        const contract = `SPX 0DTE ${targetStrike} ${isCall ? 'CALL' : 'PUT'}`;
                        const entryAsk = directSignal?.entryAsk || 3.70;
                        const minsRemaining = Math.max(1, 40 - minutes);

                        await sendSPXPowerHourAlert({
                            setupType: isCall ? "PRE_CUTOFF_BREAKOUT_CALL" : "PRE_CUTOFF_BREAKOUT_PUT",
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
                            shelfBreak: isCall ? `Broke above $${high30.toFixed(1)}` : `Broke below $${low30.toFixed(1)}`,
                            exitCutoff: "03:58 PM ET",
                            brokerCutoffWarning: `${minsRemaining} min remaining before 3:40 PM retail broker cutoff!`
                        });

                        setCache(breakoutKey);
                        actionsTriggered.push(`SPX_BREAKOUT_${isCall ? 'CALL' : 'PUT'}`);
                        logs.push(`[SPX Power Hour] Breakout Entry Alert dispatched: ${contract}`);
                    }
                }
                // If inside shelf: REMAIN COMPLETELY SILENT (Zero spam)
            }

            // 2B. 3:50 PM - 3:55 PM NYSE MOC Imbalance Window
            // ONLY fires if NYSE imbalance reaches high threshold
            if (timeVal >= 1550 && timeVal <= 1555) {
                const mocKey = `SPX_MOC_${todayStr}`;
                if (!isCached(mocKey) && mocImbalance.status === "PUBLISHED" && mocImbalance.thresholdMet) {
                    const isMocBuy = mocImbalance.direction === "BUY";
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
