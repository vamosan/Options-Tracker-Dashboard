const YahooFinance = require('yahoo-finance2').default || require('yahoo-finance2');
const yahooFinance = new YahooFinance();
const Parser = require('rss-parser');
const vader = require('vader-sentiment');

const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { logSignal } = require('./ledger');

const parser = new Parser();
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
        const feed = await parser.parseURL(rssUrl);
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
        console.warn(`Failed to parse RSS for ${symbol}:`, e.message);
        return { score: 0, headlines: ["Failed to fetch news."] };
    }
}

function determineSentimentLabel(score) {
    if (score >= 0.15) return "🟢 POSITIVE";
    if (score <= -0.15) return "🔴 NEGATIVE";
    return "⚪ NEUTRAL";
}

function calculateConfidence(ratio, sentiment, volume, alignment) {
    const sentimentFactor = Math.min(Math.abs(sentiment) / 0.5, 1.0) * 40;
    const ratioFactor = Math.min((ratio - 2.5) / 7.5, 1.0) * 40;
    const volumeFactor = Math.min(volume / 5000, 1.0) * 20;
    
    let score = Math.round(sentimentFactor + ratioFactor + volumeFactor);
    if (alignment.includes("UNALIGNED") || alignment.includes("Divergence")) {
        score = Math.floor(score * 0.5); // 50% penalty for weak alignment
    }
    return Math.min(Math.max(score, 10), 99); // Bound between 10% and 99%
}

async function scanTickerForMomentum(yf, symbol) {
    const alerts = [];
    try {
        let optionsResult = null;
        let quote = null;
        let usingWebullOptions = true;

        try {
            const webullQuotesPath = path.join(process.cwd(), 'src', 'lib', 'agentic-desk', 'fetch_webull_quotes.py');
            const { stdout: quoteOut } = await execAsync(`python "${webullQuotesPath}" "${symbol}"`, {
                env: { ...process.env, PYTHONIOENCODING: 'utf8', PYTHONUTF8: '1' }
            });
            const quoteData = JSON.parse(quoteOut.trim());
            if (quoteData.error) throw new Error(quoteData.error);
            quote = quoteData;

            const webullOptionsPath = path.join(process.cwd(), 'src', 'lib', 'agentic-desk', 'fetch_webull_options.py');
            const { stdout: optionsOut } = await execAsync(`python "${webullOptionsPath}" "${symbol}"`, {
                env: { ...process.env, PYTHONIOENCODING: 'utf8', PYTHONUTF8: '1' }
            });
            const optionsData = JSON.parse(optionsOut.trim());
            if (optionsData.error) throw new Error(optionsData.error);
            
            if (optionsData.contracts && optionsData.contracts.length > 0) {
                const expirations = {};
                for (const c of optionsData.contracts) {
                    if (!expirations[c.expiration]) expirations[c.expiration] = { expirationDate: c.expiration, calls: [], puts: [] };
                    if (c.type === 'calls') expirations[c.expiration].calls.push(c);
                    else expirations[c.expiration].puts.push(c);
                }
                const sortedExps = Object.values(expirations).sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));
                optionsResult = { options: sortedExps };
            } else {
                throw new Error("No contracts");
            }
        } catch (e) {
            console.warn(`[Webull API] Fallback to Yahoo for ${symbol}: ${e.message}`);
            usingWebullOptions = false;
        }

        if (!usingWebullOptions) {
            optionsResult = await yf.options(symbol);
            quote = await yf.quote(symbol);
        }

        if (!optionsResult.options || optionsResult.options.length === 0) return [];

        // Focus on the closest expiration date (highest gamma and volatility for scalping)
        const nearestExp = optionsResult.options[0];
        const expirationStr = nearestExp.expirationDate;
        const expDate = new Date(expirationStr);
        const daysToExpiry = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 3600 * 24));

        if (daysToExpiry > MAX_DAYS_TO_EXP) return [];

        const underlyingPrice = quote.regularMarketPrice || quote.price || 0;

        const allContracts = [
            ...(nearestExp.calls || []).map(c => ({ ...c, type: "Call" })),
            ...(nearestExp.puts || []).map(p => ({ ...p, type: "Put" }))
        ];

        let closes = [];
        let usingWebull = true;
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);

        try {
            const webullScriptPath = path.join(process.cwd(), 'src', 'lib', 'agentic-desk', 'fetch_webull.py');
            const { stdout } = await execAsync(`python "${webullScriptPath}" "${symbol}"`, {
                env: { ...process.env, PYTHONIOENCODING: 'utf8', PYTHONUTF8: '1' }
            });
            
            const webullData = JSON.parse(stdout.trim());
            if (webullData.error || !webullData.close || webullData.close.length < 200) {
                usingWebull = false;
            } else {
                closes = webullData.close;
            }
        } catch (e) {
            usingWebull = false;
        }

        if (!usingWebull) {
            // Use chart instead of historical to support v3 correctly without null errors
            const chartData = await yahooFinance.chart(symbol, {
                period1: startDate,
                interval: '1d'
            });
            const historical = chartData.quotes.filter(q => q.close !== null);
            closes = historical.map(day => day.close);
        }

        let passingSetups = [];

        for (const contract of allContracts) {
            const volume = contract.volume || 0;
            const oi = contract.openInterest || 0;
            const lastPrice = contract.lastPrice || 0;

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
                let alignment = "UNALIGNED (Speculative)";
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
                io.emit("momentum_trade_alert", alert);
                
                // Log to SQLite Ledger (Only high quality entries)
                if (alert.confidenceScore >= 50 && !alert.alignment.includes("UNALIGNED")) {
                    const action = `BUY ${alert.type.toUpperCase()}`;
                    const rationale = `${alert.alignment} | Vol/OI: ${alert.volumeRatio.toFixed(2)}x`;
                    logSignal(alert.symbol, action, rationale, alert.marketPrice, alert.confidenceScore).catch(e => console.error("Ledger Error:", e));
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
                console.log(`[0DTE SPY ALERT] ${alert.alignment} Found: ${alert.symbol} $${alert.strike} ${alert.type}`);
                io.emit("momentum_trade_alert", alert);
                
                // Log to SQLite Ledger (Only high quality entries)
                if (alert.confidenceScore >= 50 && !alert.alignment.includes("UNALIGNED")) {
                    const action = `BUY ${alert.type.toUpperCase()}`;
                    const rationale = `0DTE Scalp | ${alert.alignment}`;
                    logSignal(alert.symbol, action, rationale, alert.marketPrice, alert.confidenceScore).catch(e => console.error("Ledger Error:", e));
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
