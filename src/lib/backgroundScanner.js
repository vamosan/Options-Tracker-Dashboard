const yahooFinance = require('yahoo-finance2').default;

// Suppress cookie warnings
const originalWarn = console.warn;
console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('cookie')) return;
    originalWarn.apply(console, args);
};

// Alert cooldown cache: contractSymbol -> timestamp
const alertCooldowns = new Map();
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

// Cumulative Standard Normal Distribution
function cnd(x) {
    const a1 = 0.31938153;
    const a2 = -0.356563782;
    const a3 = 1.781477937;
    const a4 = -1.821255978;
    const a5 = 1.330274429;
    const L = Math.abs(x);
    const k = 1.0 / (1.0 + 0.2316419 * L);
    let d = 1.0 - 1.0 / Math.sqrt(2 * Math.PI) * Math.exp(-L * L / 2) * 
            (a1 * k + a2 * k * k + a3 * Math.pow(k, 3) + a4 * Math.pow(k, 4) + a5 * Math.pow(k, 5));

    if (x < 0) d = 1.0 - d;
    return d;
}

// Black-Scholes Pricing
function blackScholes(S, K, T, r, v, type) {
    if (T <= 0) {
        return type === "Call" || type === "call" ? Math.max(0, S - K) : Math.max(0, K - S);
    }
    const d1 = (Math.log(S / K) + (r + (v * v) / 2) * T) / (v * Math.sqrt(T));
    const d2 = d1 - v * Math.sqrt(T);
    if (type === "Call" || type === "call") {
        return S * cnd(d1) - K * Math.exp(-r * T) * cnd(d2);
    } else {
        return K * Math.exp(-r * T) * cnd(-d2) - S * cnd(-d1);
    }
}

// Calculate HV
function calculateHV(prices) {
    if (prices.length < 2) return 0.25;
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push(Math.log(prices[i] / prices[i - 1]));
    }
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const dailyStdDev = Math.sqrt(variance);
    return dailyStdDev * Math.sqrt(252);
}

// Fetch HV helper
async function fetchHV(yf, symbol) {
    try {
        const today = new Date();
        const start = new Date();
        start.setDate(today.getDate() - 45);

        const hist = await yf.historical(symbol, {
            period1: start.toISOString().split('T')[0],
            period2: today.toISOString().split('T')[0],
            interval: '1d'
        });

        const closes = hist.map(bar => bar.close).filter(val => typeof val === 'number');
        if (closes.length < 5) throw new Error("Insufficient history");
        return calculateHV(closes);
    } catch (e) {
        const fallbacks = {
            "SPY": 0.13, "QQQ": 0.16, "NVDA": 0.45, "TSLA": 0.52, "AAPL": 0.22,
            "AMD": 0.38, "MSFT": 0.20, "AMZN": 0.24, "META": 0.28, "GOOGL": 0.21
        };
        return fallbacks[symbol.toUpperCase()] || 0.25;
    }
}

// Scan a single ticker
async function scanTickerForAlerts(yf, symbol) {
    const alerts = [];
    try {
        const quote = await yf.quote(symbol);
        const S = quote.regularMarketPrice || quote.price || 0;
        if (S === 0) return [];

        const HV = await fetchHV(yf, symbol);
        const optionsResult = await yf.options(symbol);
        if (!optionsResult.options || optionsResult.options.length === 0) return [];

        // Scan first 2 chains
        for (let i = 0; i < Math.min(2, optionsResult.options.length); i++) {
            const chain = optionsResult.options[i];
            const expirationStr = chain.expirationDate;
            const expDate = new Date(expirationStr);
            const daysToExpiry = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 3600 * 24));

            if (daysToExpiry < 3 || daysToExpiry > 45) continue;

            const T = daysToExpiry / 365;
            const r = 0.05;

            const allContracts = [
                ...(chain.calls || []).map(c => ({ ...c, type: "Call" })),
                ...(chain.puts || []).map(p => ({ ...p, type: "Put" }))
            ];

            for (const contract of allContracts) {
                const K = contract.strike;
                const marketPrice = contract.lastPrice || 0;
                const IV = contract.impliedVolatility || 0;

                if (marketPrice <= 0.05 || IV <= 0) continue;
                if ((contract.volume || 0) < 10) continue; // higher volume baseline for active alerts

                // Strike must be within 8% of underlying
                const strikeDiff = Math.abs(K - S) / S;
                if (strikeDiff > 0.08) continue;

                const theoreticalPrice = blackScholes(S, K, T, r, HV, contract.type);

                let action = null;
                let edgePercent = 0;

                if (IV < HV - 0.10 && theoreticalPrice > marketPrice * 1.20) {
                    action = "BUY";
                    edgePercent = ((theoreticalPrice - marketPrice) / marketPrice) * 100;
                } else if (IV > HV + 0.15 && marketPrice > theoreticalPrice * 1.25) {
                    action = "SELL";
                    edgePercent = ((marketPrice - theoreticalPrice) / marketPrice) * 100;
                }

                if (action && edgePercent > 15) {
                    alerts.push({
                        symbol,
                        contractSymbol: contract.contractSymbol,
                        type: contract.type,
                        strike: K,
                        expiration: expirationStr,
                        marketPrice: parseFloat(marketPrice.toFixed(2)),
                        theoreticalPrice: parseFloat(theoreticalPrice.toFixed(2)),
                        iv: parseFloat((IV * 100).toFixed(1)),
                        hv: parseFloat((HV * 100).toFixed(1)),
                        edgePercent: parseFloat(edgePercent.toFixed(1)),
                        action,
                        volume: contract.volume || 0,
                        openInterest: contract.openInterest || 0,
                        timestamp: new Date().toLocaleTimeString()
                    });
                }
            }
        }
    } catch (e) {
        // Quietly fail for individual tickers
    }
    return alerts;
}

// Main background loop
function startBackgroundScanner(io) {
    console.log("[Background Scanner] Initializing real-time option alerts...");

    let yf = yahooFinance;
    if (typeof yf === 'function') {
        yf = new yf();
    }

    const scanBasket = ["NVDA", "TSLA", "AAPL", "AMD", "META", "AMZN", "MSFT", "GOOGL", "SPY"];
    let tickerIndex = 0;

    async function runScanCycle() {
        try {
            // Scan 2 tickers at a time per minute to keep within Yahoo rate limits & preserve resources
            const symbolsToScan = [
                scanBasket[tickerIndex % scanBasket.length],
                scanBasket[(tickerIndex + 1) % scanBasket.length]
            ];
            tickerIndex += 2;

            // console.log(`[Background Scanner] Running active scan for: ${symbolsToScan.join(', ')}`);
            
            const results = await Promise.all(
                symbolsToScan.map(sym => scanTickerForAlerts(yf, sym))
            );

            const allAlerts = results.flat();
            let sentAlertCount = 0;

            for (const alert of allAlerts) {
                const now = Date.now();
                const lastSent = alertCooldowns.get(alert.contractSymbol) || 0;

                if (now - lastSent > COOLDOWN_MS) {
                    // Send alert to websocket clients
                    console.log(`[ALERT] +EV Option Found: ${alert.action} ${alert.symbol} $${alert.strike} ${alert.type} (Edge: +${alert.edgePercent}%)`);
                    io.emit("profitable_trade_alert", alert);
                    alertCooldowns.set(alert.contractSymbol, now);
                    sentAlertCount++;
                    
                    // Only alert one per cycle to avoid flooding
                    if (sentAlertCount >= 1) break;
                }
            }

            // If no real alerts are found (common outside market hours), inject a simulated alert every 10 minutes
            // to allow developer/user to verify that visual notification toasts & sound synthesis work.
            if (sentAlertCount === 0) {
                const now = Date.now();
                const lastSimulated = alertCooldowns.get("SIMULATED_ALERT") || 0;
                
                if (now - lastSimulated > 90 * 1000) { // 90 seconds (demo mode)
                    const demoStocks = ["NVDA", "TSLA", "AAPL", "AMD"];
                    const chosenStock = demoStocks[Math.floor(Math.random() * demoStocks.length)];
                    const strikeOffset = Math.random() > 0.5 ? 2.5 : -2.5;
                    
                    // Fetch estimated stock price
                    let price = 140;
                    if (chosenStock === "TSLA") price = 180;
                    if (chosenStock === "AAPL") price = 220;
                    if (chosenStock === "AMD") price = 160;

                    const strike = Math.round((price + strikeOffset) * 2) / 2;
                    const type = Math.random() > 0.5 ? "Call" : "Put";
                    const edge = 15 + Math.floor(Math.random() * 25);
                    const iv = 35 + Math.floor(Math.random() * 15);
                    const hv = iv + (Math.random() > 0.5 ? 12 : -12);
                    const action = iv < hv ? "BUY" : "SELL";

                    const expiryDate = new Date();
                    expiryDate.setDate(expiryDate.getDate() + 14); // 2 weeks out
                    
                    const simulatedAlert = {
                        symbol: chosenStock,
                        contractSymbol: `${chosenStock}_SIM_${Date.now()}`,
                        type,
                        strike,
                        expiration: expiryDate.toISOString().split('T')[0],
                        marketPrice: parseFloat((1.5 + Math.random() * 3).toFixed(2)),
                        theoreticalPrice: parseFloat((2.0 + Math.random() * 4).toFixed(2)),
                        iv,
                        hv,
                        edgePercent: edge,
                        action,
                        volume: 850 + Math.floor(Math.random() * 500),
                        openInterest: 3500 + Math.floor(Math.random() * 2000),
                        timestamp: new Date().toLocaleTimeString(),
                        isSimulated: true
                    };

                    console.log(`[ALERT] Broadcasting Simulated +EV Option (Demo Mode): ${simulatedAlert.action} ${simulatedAlert.symbol} (Edge: +${simulatedAlert.edgePercent}%)`);
                    io.emit("profitable_trade_alert", simulatedAlert);
                    alertCooldowns.set("SIMULATED_ALERT", now);
                }
            }

        } catch (err) {
            console.error("[Background Scanner Error]", err);
        }
    }

    // Run scanner every 60 seconds
    const intervalId = setInterval(runScanCycle, 60000);
    
    // Trigger initial scan after 5 seconds to wake up server
    setTimeout(runScanCycle, 5000);

    return () => {
        clearInterval(intervalId);
    };
}

module.exports = {
    startBackgroundScanner
};
