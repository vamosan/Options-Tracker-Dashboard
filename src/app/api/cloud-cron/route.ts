import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getLiveSPXPowerHourData } from '@/lib/spxPowerHour';
import { 
    sendDiscordWebhook, 
    sendTradeEntryCallout, 
    sendSPXPowerHourAlert,
    DEFAULT_DISCORD_WEBHOOK_URL 
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

    // ==========================================
    // 1. MORNING SESSION (9:30 AM - 10:15 AM ET)
    // ==========================================
    if (timeVal >= 930 && timeVal <= 1015) {
        const morningKey = `MORNING_BELL_${todayStr}`;
        if (!isCached(morningKey)) {
            logs.push(`[Morning Session] 9:30 AM Opening Bell briefing armed`);
            await sendDiscordWebhook({
                username: "Options Tracker AI • Real-Time Desk",
                embeds: [{
                    title: "🔔 US MARKET OPEN: MORNING MOMENTUM & ORB DESK ARMED",
                    description: "**Opening Range Breakout (ORB) Engine Active (9:30 - 10:15 AM ET)**\nCloud scanner monitoring high-conviction order flow across the focus universe. Looking for 5-min opening shelf expansions with Vol/OI > 2.5x.",
                    color: 0x3B82F6,
                    fields: [
                        { name: "⏱️ Market Session", value: `**${timeDisplay} Opening Bell**`, inline: true },
                        { name: "📊 Watchlist", value: "`TSLA`, `AMD`, `NVDA`, `META`, `AAPL`, `SPY`, `QQQ`", inline: true },
                        { name: "🎯 Strategy", value: "• 5-min ORB High/Low Breakouts\n• Target: Take quick opening pop (5-15 min hold)\n• Stop Loss: Strict -20% max loss", inline: false }
                    ],
                    footer: { text: "Options Tracker AI • Cloud Cron Autonomous Monitor" },
                    timestamp: new Date().toISOString()
                }]
            });
            setCache(morningKey);
            actionsTriggered.push("MORNING_BELL_BRIEFING");
        }
    }

    // ==========================================
    // 2. SPX POWER HOUR (3:00 PM - 4:00 PM ET)
    // ==========================================
    if (timeVal >= 1500 && timeVal <= 1600) {
        try {
            const spxData = await getLiveSPXPowerHourData();
            const { spxSpot, rangeShelf, mocImbalance, directSignal } = spxData;
            const high30 = rangeShelf.high30;
            const low30 = rangeShelf.low30;

            logs.push(`[SPX Power Hour] Spot: ${spxSpot.toFixed(2)} | Shelf: ${low30.toFixed(1)} - ${high30.toFixed(1)} | Direction: ${rangeShelf.breakoutDirection}`);

            // 2A. 3:00 PM Power Hour Desk Armed Notification
            const spxArmedKey = `SPX_ARMED_${todayStr}`;
            if (!isCached(spxArmedKey)) {
                await sendDiscordWebhook({
                    username: "Options Tracker AI • Real-Time Desk",
                    embeds: [{
                        title: "🎯 SPX POWER HOUR ACTIVATED: DESK ARMED",
                        description: `**Institutional Power Hour Window (3:00 - 4:00 PM ET)**\nContinuous order book monitoring active across the closing accumulation shelf.\n\n⚠️ **STANDBY: ZERO TRADES INSIDE SHELF**\nSpot is consolidating inside the shelf ($${low30.toFixed(1)} - $${high30.toFixed(1)}). Stand by for a confirmed breakout or the 3:30 PM pre-cutoff window.`,
                        color: 0x3B82F6,
                        fields: [
                            { name: "⏱️ Session Time (ET)", value: `**${timeDisplay}**`, inline: true },
                            { name: "📊 SPX Index Spot", value: `**$${spxSpot.toFixed(2)}**`, inline: true },
                            { name: "🧱 Accumulation Shelf", value: `**$${low30.toFixed(1)} - $${high30.toFixed(1)}**`, inline: true }
                        ],
                        footer: { text: "SPX 0DTE Power Hour Desk • Cloud Autonomous Monitor" },
                        timestamp: new Date().toISOString()
                    }]
                });
                setCache(spxArmedKey);
                actionsTriggered.push("SPX_ARMED_BRIEFING");
            }

            // 2B. 3:30 PM - 3:39 PM Pre-Broker Cutoff Breakout Window
            if (timeVal >= 1530 && timeVal <= 1539) {
                const isCall = rangeShelf.breakoutDirection === "UPWARD_BREAKOUT";
                const isPut = rangeShelf.breakoutDirection === "DOWNWARD_BREAKOUT";

                if (isCall || isPut) {
                    const breakoutKey = `SPX_BREAKOUT_${todayStr}`;
                    if (!isCached(breakoutKey)) {
                        const targetStrike = isCall ? Math.ceil((high30 + 4) / 5) * 5 : Math.floor((low30 - 4) / 5) * 5;
                        const contract = `SPX 0DTE ${targetStrike} ${isCall ? 'CALL' : 'PUT'}`;
                        const entryAsk = directSignal.entryAsk || 0.70;
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
                            stopLoss: Math.round(entryAsk * 0.7 * 100) / 100,
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
                        logs.push(`[SPX Power Hour] Breakout Alert dispatched: ${contract}`);
                    }
                } else if (timeVal >= 1535) {
                    // Inside shelf at 3:35 PM: Send capital preservation status
                    const inShelfKey = `SPX_INSHELF_STATUS_${todayStr}`;
                    if (!isCached(inShelfKey)) {
                        await sendDiscordWebhook({
                            username: "Options Tracker AI • Real-Time Desk",
                            embeds: [{
                                title: "🛡️ SPX POWER HOUR: NO ENTRY — SHELF CONSOLIDATION",
                                description: `**Pre-Cutoff Window Status (3:35 PM ET)**\nSPX is consolidating inside the accumulation shelf between **$${low30.toFixed(1)}** and **$${high30.toFixed(1)}** (Current Spot: **$${spxSpot.toFixed(2)}**).\n\n✅ **Capital Preserved: ZERO TRADES TAKEN.**\nTaking trades inside the shelf guarantees theta chop. Next potential trigger: 3:50 PM MOC Imbalance.`,
                                color: 0xF59E0B,
                                fields: [
                                    { name: "⏱️ Session Time", value: `**${timeDisplay}**`, inline: true },
                                    { name: "🧱 Shelf Range", value: `**$${low30.toFixed(1)} - $${high30.toFixed(1)}**`, inline: true }
                                ],
                                footer: { text: "SPX 0DTE Discipline Desk • Capital Preservation" },
                                timestamp: new Date().toISOString()
                            }]
                        });
                        setCache(inShelfKey);
                        actionsTriggered.push("SPX_INSHELF_CAPITAL_PRESERVED");
                        logs.push("[SPX Power Hour] Shelf consolidation status dispatched");
                    }
                }
            }

            // 2C. 3:50 PM - 3:55 PM NYSE MOC Imbalance Window
            if (timeVal >= 1550 && timeVal <= 1555) {
                const mocKey = `SPX_MOC_${todayStr}`;
                if (!isCached(mocKey) && mocImbalance.status === "PUBLISHED" && mocImbalance.thresholdMet) {
                    const isMocBuy = mocImbalance.direction === "BUY";
                    const targetStrike = isMocBuy ? Math.ceil((high30 + 4) / 5) * 5 : Math.floor((low30 - 4) / 5) * 5;
                    const contract = `SPX 0DTE ${targetStrike} ${isMocBuy ? 'CALL' : 'PUT'}`;
                    const entryAsk = directSignal.entryAsk || 0.70;

                    await sendSPXPowerHourAlert({
                        setupType: isMocBuy ? "MOC_GAMMA_CALL" : "MOC_GAMMA_PUT",
                        triggerTime: timeDisplay,
                        spxSpot,
                        contract,
                        strike: targetStrike,
                        entryAsk,
                        target1: Math.round(entryAsk * 2.2 * 100) / 100,
                        target2: Math.round(entryAsk * 4.5 * 100) / 100,
                        stopLoss: 0.20,
                        maxRiskPerContract: Math.round(entryAsk * 100),
                        mocImbalance: mocImbalance.rawText,
                        mocImbalanceType: mocImbalance.direction,
                        morningBias: spxData.morningMomentumBias.bias,
                        shelfBreak: `NYSE MOC Imbalance: ${mocImbalance.rawText}`,
                        exitCutoff: "03:58 PM ET"
                    });

                    setCache(mocKey);
                    actionsTriggered.push("SPX_MOC_ALERT");
                    logs.push(`[SPX Power Hour] MOC Alert dispatched: ${contract}`);
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
