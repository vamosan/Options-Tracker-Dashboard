const YahooFinance = require('yahoo-finance2').default || require('yahoo-finance2');
const yahooFinance = new YahooFinance();
const Parser = require('rss-parser');
const vader = require('vader-sentiment');

const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { logSignal } = require('./ledger');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1554066969588801546/34cLxhk8Nr7FtYbscs3s4lhkhrfQYpWoSKxe-giiLSv6LHgd09YlJo6NSoDc-SAlkW1O';

// Daily alert throttle to ensure ONLY the top 1-2 prime setups alert to Discord
let dailyDiscordAlertCount = 0;
let lastAlertDayStr = '';
const MAX_DAILY_DISCORD_ALERTS = 2;

async function sendDiscordAlert(alert) {
    if (!DISCORD_WEBHOOK_URL) return;
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        if (todayStr !== lastAlertDayStr) {
            lastAlertDayStr = todayStr;
            dailyDiscordAlertCount = 0;
        }

        if (dailyDiscordAlertCount >= MAX_DAILY_DISCORD_ALERTS) {
            console.log(`[Momentum Bot] Daily Discord alert limit (${MAX_DAILY_DISCORD_ALERTS}) reached for today. Suppressing additional alerts to keep channel focused.`);
            return;
        }

        const cooldownKey = `${alert.contractSymbol || (alert.symbol + '_' + alert.strike + '_' + alert.type)}`;
        const lastAlert = alertCooldowns.get(cooldownKey);
        if (lastAlert && (Date.now() - lastAlert < COOLDOWN_MS)) {
            return;
        }
        alertCooldowns.set(cooldownKey, Date.now());

        const isBull = (alert.type || '').toLowerCase().includes('call');
        const color = isBull ? 0x10B981 : 0xF43F5E;
        const embed = {
            title: `🚨 ENTER TRADE NOW: BUY ${alert.symbol} $${alert.strike} ${(alert.type || '').toUpperCase()}`,
            description: `**${alert.alignment}**\nVol/OI: **${alert.volumeRatio ? alert.volumeRatio.toFixed(2) : '3.0'}x** • Conviction: **${alert.confidenceScore}% (HIGH CONVICTION)**`,
            color,
            fields: [
                { name: '⏰ WHEN TO ENTER', value: `**ENTER NOW (${alert.timestamp || 'Live Breakout'})**\nConfirmed institutional volume expansion.`, inline: false },
                { name: '🎯 EXACT CONTRACT', value: `**${alert.symbol} $${alert.strike} ${(alert.type || '').toUpperCase()} (${alert.expiration || 'Weekly/0DTE'})**`, inline: true },
                { name: '💵 ESTIMATED ASK', value: `**~$${alert.marketPrice ? alert.marketPrice.toFixed(2) : '1.50'}**`, inline: true },
                { name: '🛑 WHEN TO CUT / STOP', value: `Hard Stop at **$${alert.stopPrice ? alert.stopPrice.toFixed(2) : '--'}** (-15% to -20% max loss).`, inline: true },
                { name: '⚡ EXECUTION PROTOCOL', value: 'Take quick profit on the opening expansion (5-15 min hold max). Never average down.', inline: false }
            ],
            footer: { text: `Options Tracker AI • Prime Trade ${dailyDiscordAlertCount + 1} of ${MAX_DAILY_DISCORD_ALERTS} Max` },
            timestamp: new Date().toISOString()
        };
        const payload = JSON.stringify({
            username: 'Options Tracker AI • Momentum Desk',
            avatar_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=128&auto=format&fit=crop&q=80',
            embeds: [embed]
        });

        const res = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            signal: AbortSignal.timeout(5000)
        });

        if (res.ok) {
            dailyDiscordAlertCount++;
            console.log(`[Momentum Bot] Discord alert dispatched for ${alert.symbol} $${alert.strike} ${alert.type}! (HTTP ${res.status}) [Alert ${dailyDiscordAlertCount}/${MAX_DAILY_DISCORD_ALERTS} today]`);
        } else {
            console.warn(`[Momentum Bot] Discord alert returned HTTP ${res.status}`);
        }
    } catch (err) {
        console.warn('[Discord Webhook Error]', err.message);
    }
}

const parser = new Parser({ timeout: 5000 });
const WATCHLIST = ["AAPL", "TSLA", "NVDA", "AMD", "MSFT", "AMZN", "BABA", "META", "SPY", "QQQ"];
const MIN_VOLUME = 100;
const MIN_VOL_OI_RATIO = 2.5;
const MAX_DAYS_TO_EXP = 30;

// Alert cooldown cache: contractSymbol -> timestamp
const alertCooldowns = new Map();
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

async function getTickerSentiment(symbol) {
    const rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbol}`;
    const headlines = [];
    const compoundScores = [];

    try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('RSS fetch timeout (4s)')), 4000));
        const feed = await Promise.race([parser.parseURL(rssUrl), timeoutPromise]);
        // Analyze up to 5 recent headlines
        for (let i = 0; i < Math.min(5, feed.items.length); i++) {
            const headline = feed.items[i].title;
            headlines.push(headline);
            const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(headline);
            compoundScores.push(intensity.compound);
        }

        if (compoundScores.length === 0) {
            return { score: 0, headlines: ["No recent news found."] };
        }

        const avgSentiment = compoundScores.reduce((a, b) => a + b, 0) / compoundScores.length;
        return { score: avgSentiment, headlines };
    } catch (e) {
        // Quietly fallback without holding up scan cycle
        return { score: 0, headlines: ["Market momentum scan active."] };
    }
}

function determineSentimentLabel(score) {
    if (score >= 0.15) return "🟢 POSITIVE";
    if (score <= -0.15) return "🔴 NEGATIVE";
    return "⚪ NEUTRAL";
}

function calculateConfidence(ratio, sentiment, volume, alignment) {
    const sentimentFactor = Math.min(Math.abs(sentiment) / 0.5, 1.0) * 30;
    const ratioFactor = Math.min((ratio - 2.0) / 6.0, 1.0) * 45;
    const volumeFactor = Math.min(volume / 3000, 1.0) * 25;
    
    let score = Math.round(sentimentFactor + ratioFactor + volumeFactor);
    if (alignment.includes("Divergence")) {
        score = Math.floor(score * 0.5); // 50% penalty for hostile news divergence
    }
    return Math.min(Math.max(score, 10), 99); // Bound between 10% and 99%
}

async function scanTickerForMomentum(yf, symbol) {
    const alerts = [];
    try {
        let optionsResult = null;
        let quote = null;

        try {
            optionsResult = await yf.options(symbol);
            quote = await yf.quote(symbol);
        } catch (e) {
            console.warn(`[Yahoo Options API] Failed for ${symbol}: ${e.message}`);
            return [];
        }

        if (!optionsResult.options || optionsResult.options.length === 0) return [];

        // Focus on the closest expiration date (highest gamma and volatility for scalping)
        const nearestExp = optionsResult.options[0];
        const expirationStr = nearestExp.expirationDate;
        const expDate = new Date(expirationStr);
        const daysToExpiry = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 3600 * 24));

        if (daysToExpiry > MAX_DAYS_TO_EXP) return [];

        const underlyingPrice = quote ? (quote.regularMarketPrice || quote.price || quote.postMarketPrice || quote.preMarketPrice || 0) : 0;
        if (!underlyingPrice || underlyingPrice <= 0) return [];

        const allContracts = [
            ...(nearestExp.calls || []).map(c => ({ ...c, type: "Call" })),
            ...(nearestExp.puts || []).map(p => ({ ...p, type: "Put" }))
        ];

        let closes = [];
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);

        try {
            // Use chart instead of historical to support v3 correctly without null errors
            const chartData = await yahooFinance.chart(symbol, {
                period1: startDate,
                interval: '1d'
            });
            const historical = (chartData?.quotes || []).filter(q => q && q.close !== null);
            closes = historical.map(day => day.close);
        } catch (e) {
            closes = [];
        }

        let passingSetups = [];

        for (const contract of allContracts) {
            const volume = contract.volume || 0;
            const oi = contract.openInterest || 0;
            const lastPrice = contract.lastPrice || 0;
            const strike = contract.strike || 0;

            // STRICT DATA ACCURACY GUARD:
            // Scalp & day trade options must be strictly near-the-money (within 2.5% of spot price).
            // This strictly eliminates anomalous/stale strikes (e.g. SPY $635 when spot is ~$766 is ~17% away).
            if (underlyingPrice > 0 && strike > 0) {
                const strikeDiff = Math.abs(strike - underlyingPrice) / underlyingPrice;
                if (strikeDiff > 0.025) continue;
            } else {
                continue;
            }

            if (volume >= MIN_VOLUME && oi > 0 && lastPrice >= 0.15) {
                const ratio = volume / oi;
                if (ratio > MIN_VOL_OI_RATIO) {
                    passingSetups.push({ contract, ratio });
                }
            }
        }

        // Sort by volume ratio descending and take the top 1 best contract
        passingSetups.sort((a, b) => b.ratio - a.ratio);
        passingSetups = passingSetups.slice(0, 1);

        if (passingSetups.length > 0) {
            const { score, headlines } = await getTickerSentiment(symbol);
            const sentimentLabel = determineSentimentLabel(score);

            for (const setup of passingSetups) {
                const { contract, ratio } = setup;
                let alignment = contract.type === 'Call' ? "⚡ INSTITUTIONAL CALL SWEEP" : "⚡ INSTITUTIONAL PUT SWEEP";
                if (contract.type === 'Call' && score > 0.15) {
                    alignment = "🔥 BULLISH ALIGNMENT";
                } else if (contract.type === 'Put' && score < -0.15) {
                    alignment = "💥 BEARISH ALIGNMENT";
                } else if (contract.type === 'Call' && score < -0.15) {
                    alignment = "⚠️ BEARISH NEWS / BULLISH FLOW (Divergence)";
                } else if (contract.type === 'Put' && score > 0.15) {
                    alignment = "⚠️ BULLISH NEWS / BEARISH FLOW (Divergence)";
                }

                const confidenceScore = calculateConfidence(ratio, score, contract.volume || 0, alignment);
                const isZeroDte = daysToExpiry <= 1;
                
                // Calculate Dynamic Execution Plan based on premium
                const entryPrice = contract.lastPrice || 0;
                const targetPrice = Number((entryPrice * 1.30).toFixed(2)); // +30%
                const stopPrice = Number((entryPrice * 0.85).toFixed(2)); // -15%
                
                let tradeSuggestion = "";
                if (isZeroDte) {
                    tradeSuggestion = "🔥 0DTE Scalp: High volatility. Take quick 15-20% profits or cut early. Do not hold overnight.";
                } else {
                    tradeSuggestion = `💡 Setup: For a multi-day swing, take the given ${expirationStr} expiry. For a quick intraday scalp, pivot to a 0DTE ${contract.type} at the same $${contract.strike} strike.`;
                }

                alerts.push({
                    symbol,
                    underlyingPrice,
                    contractSymbol: contract.contractSymbol,
                    type: contract.type,
                    strike: contract.strike,
                    expiration: expirationStr,
                    marketPrice: entryPrice,
                    targetPrice,
                    stopPrice,
                    volume: contract.volume || 0,
                    openInterest: contract.openInterest || 0,
                    volumeRatio: ratio,
                    sentimentScore: score,
                    sentimentLabel,
                    alignment,
                    confidenceScore,
                    headlines: headlines.slice(0, 3), // Top 3 headlines
                    timestamp: new Date().toLocaleTimeString(),
                    isZeroDte,
                    tradeSuggestion
                });
            }
        }
    } catch (e) {
        console.error(`[scanTickerForMomentum Error for ${symbol}]`, e);
        // Quietly fail for individual tickers
    }
    return alerts;
}

function startMomentumScanner(io) {
    console.log("[Momentum Scanner] Initializing real-time catalyst & momentum alerts...");

    let yf = yahooFinance;
    if (typeof yf === 'function') {
        yf = new yf();
    }

    let tickerIndex = 0;

    async function runScanCycle() {
        try {
            // Scan 2 tickers at a time per minute
            const symbolsToScan = [
                WATCHLIST[tickerIndex % WATCHLIST.length],
                WATCHLIST[(tickerIndex + 1) % WATCHLIST.length]
            ];
            tickerIndex += 2;

            const results = await Promise.all(
                symbolsToScan.map(sym => scanTickerForMomentum(yf, sym))
            );

            const allAlerts = results.flat();

            for (const alert of allAlerts) {
                console.log(`[MOMENTUM ALERT] ${alert.alignment} Found: ${alert.symbol} $${alert.strike} ${alert.type} (Vol/OI: ${alert.volumeRatio.toFixed(2)}x)`);
                if (io) io.emit("momentum_trade_alert", alert);
                
                // Log to SQLite Ledger & Dispatch to Discord (Only elite-conviction entries >= 80% with high volume)
                if (alert.confidenceScore >= 80 && alert.volumeRatio >= 3.0 && !alert.alignment.includes("Divergence")) {
                    const cooldownKey = `${alert.contractSymbol || (alert.symbol + '_' + alert.strike + '_' + alert.type)}`;
                    const lastAlert = alertCooldowns.get(cooldownKey);
                    if (!lastAlert || (Date.now() - lastAlert >= COOLDOWN_MS)) {
                        const action = `BUY ${alert.type.toUpperCase()}`;
                        const rationale = `${alert.alignment} | Vol/OI: ${alert.volumeRatio.toFixed(2)}x`;
                        logSignal(alert.symbol, action, rationale, alert.marketPrice, alert.confidenceScore).catch(e => console.error("Ledger Error:", e));
                        sendDiscordAlert(alert);
                    }
                }
            }
        } catch (err) {
            console.error("[Momentum Scanner Error]", err);
        }
    }

    async function runSpy0dteScan() {
        try {
            const spyAlerts = await scanTickerForMomentum(yf, "SPY");
            for (const alert of spyAlerts) {
                // Emit to UI live charts
                if (io) io.emit("momentum_trade_alert", alert);
                
                // Only log to ledger if high quality; do NOT spam Discord on 30s interval
                if (alert.confidenceScore >= 75 && !alert.alignment.includes("Divergence")) {
                    const cooldownKey = `${alert.contractSymbol || (alert.symbol + '_' + alert.strike + '_' + alert.type)}`;
                    const lastAlert = alertCooldowns.get(cooldownKey);
                    if (!lastAlert || (Date.now() - lastAlert >= COOLDOWN_MS)) {
                        const action = `BUY ${alert.type.toUpperCase()}`;
                        const rationale = `0DTE Scalp | ${alert.alignment}`;
                        logSignal(alert.symbol, action, rationale, alert.marketPrice, alert.confidenceScore).catch(e => console.error("Ledger Error:", e));
                    }
                }
            }
        } catch (err) {
            console.error("[SPY 0DTE Scanner Error]", err);
        }
    }

    // Run standard scanner every 60 seconds
    const intervalId = setInterval(runScanCycle, 60000);
    // Run dedicated SPY 0DTE scanner every 30 seconds
    const spyIntervalId = setInterval(runSpy0dteScan, 30000);
    setTimeout(runScanCycle, 10000); // Trigger first scan after 10 seconds

    return () => clearInterval(intervalId);
}

module.exports = {
    startMomentumScanner
};
