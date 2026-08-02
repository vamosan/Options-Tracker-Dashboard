import yahooFinance from "yahoo-finance2";
import { format, subDays } from "date-fns";

// Suppress console cookie warnings
if (typeof console !== 'undefined') {
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('cookie')) return;
        originalWarn.apply(console, args);
    };
}

// Cumulative Standard Normal Distribution
export function cnd(x: number): number {
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

// Black-Scholes Formula for Option Pricing
export function blackScholes(
    S: number,
    K: number,
    T: number,
    r: number,
    v: number,
    type: "Call" | "Put"
): number {
    if (T <= 0) {
        return type === "Call" ? Math.max(0, S - K) : Math.max(0, K - S);
    }
    const d1 = (Math.log(S / K) + (r + (v * v) / 2) * T) / (v * Math.sqrt(T));
    const d2 = d1 - v * Math.sqrt(T);
    if (type === "Call") {
        return S * cnd(d1) - K * Math.exp(-r * T) * cnd(d2);
    } else {
        return K * Math.exp(-r * T) * cnd(-d2) - S * cnd(-d1);
    }
}

// Calculate Historical Volatility from closing prices
export function calculateHistoricalVolatility(prices: number[]): number {
    if (prices.length < 2) return 0.25; // fallback 25%
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push(Math.log(prices[i] / prices[i - 1]));
    }
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const dailyStdDev = Math.sqrt(variance);
    const annualVol = dailyStdDev * Math.sqrt(252);
    return annualVol;
}

// Fetch historical volatility (30-day) for a given symbol
export async function getHistoricalVolatility(symbol: string): Promise<number> {
    try {
        let yf = yahooFinance as any;
        if (typeof yf === 'function') {
            yf = new yf();
        }

        const today = new Date();
        const start = subDays(today, 45); // Pull 45 calendar days to get ~30 trading days

        const histResult = await yf.historical(symbol, {
            period1: format(start, "yyyy-MM-dd"),
            period2: format(today, "yyyy-MM-dd"),
            interval: '1d'
        });

        const closes = histResult
            .map((bar: any) => bar.close)
            .filter((val: any): val is number => typeof val === 'number');

        if (closes.length < 5) {
            throw new Error(`Insufficient price history for ${symbol}`);
        }

        return calculateHistoricalVolatility(closes);
    } catch (e) {
        console.warn(`[HV Engine] Failed to fetch HV for ${symbol}, using default fallback:`, e);
        // Realistic fallback IV/HV values per core tickers
        const fallbacks: Record<string, number> = {
            "SPY": 0.13,
            "QQQ": 0.16,
            "NVDA": 0.45,
            "TSLA": 0.52,
            "AAPL": 0.22,
            "AMD": 0.38,
            "MSFT": 0.20,
            "AMZN": 0.24,
            "META": 0.28,
            "GOOGL": 0.21
        };
        return fallbacks[symbol.toUpperCase()] || 0.25;
    }
}

export interface ProfitableOpportunity {
    symbol: string;
    contractSymbol: string;
    type: "Call" | "Put";
    strike: number;
    expiration: string;
    marketPrice: number;
    theoreticalPrice: number;
    iv: number;
    hv: number;
    edge: number;      // Dollar edge
    edgePercent: number; // Percentage edge
    action: "BUY" | "SELL";
    volume: number;
    openInterest: number;
    description: string;
}

// Scans an option chain and returns +EV contracts
export async function scanTickerProfitableOptions(symbol: string): Promise<ProfitableOpportunity[]> {
    const opportunities: ProfitableOpportunity[] = [];
    try {
        let yf = yahooFinance as any;
        if (typeof yf === 'function') {
            yf = new yf();
        }

        // 1. Fetch live stock price
        const quote = await yf.quote(symbol);
        const S = quote.regularMarketPrice || quote.price || 0;
        if (S === 0) return [];

        // 2. Fetch Historical Volatility
        const HV = await getHistoricalVolatility(symbol);

        // 3. Fetch Options Chain
        const optionsResult = await yf.options(symbol);
        if (!optionsResult.options || optionsResult.options.length === 0) {
            return [];
        }

        // Scan the first 2 expiration chains to look for dynamic opportunities (min 3 days out)
        for (let chainIndex = 0; chainIndex < Math.min(3, optionsResult.options.length); chainIndex++) {
            const chain = optionsResult.options[chainIndex];
            const expirationStr = chain.expirationDate;
            const expDate = new Date(expirationStr);
            const daysToExpiry = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 3600 * 24));
            
            // Filter out near-term options expiring under 3 days (too high gamma/theta skew) or more than 45 days
            if (daysToExpiry < 3 || daysToExpiry > 45) continue;

            const T = daysToExpiry / 365;
            const r = 0.05; // 5% risk free rate estimate

            const allContracts = [
                ...(chain.calls || []).map((c: any) => ({ ...c, type: "Call" as const })),
                ...(chain.puts || []).map((p: any) => ({ ...p, type: "Put" as const }))
            ];

            for (const contract of allContracts) {
                const K = contract.strike;
                const marketPrice = contract.lastPrice || 0;
                const IV = contract.impliedVolatility || 0;

                // Ensure minimal liquidity and contract exists
                if (marketPrice <= 0.05 || IV <= 0) continue;
                if ((contract.volume || 0) < 5 && (contract.openInterest || 0) < 10) continue;

                // Near the money filters: Strike must be within 10% of underlying price S
                const strikeDiff = Math.abs(K - S) / S;
                if (strikeDiff > 0.10) continue;

                // Calculate theoretical price at HV
                const theoreticalPrice = blackScholes(S, K, T, r, HV, contract.type);

                let action: "BUY" | "SELL" | null = null;
                let edge = 0;
                let edgePercent = 0;

                // Buy option: option is undervalued (IV is lower than HV by at least 8% absolute, and BS price is higher)
                if (IV < HV - 0.08 && theoreticalPrice > marketPrice * 1.15) {
                    action = "BUY";
                    edge = theoreticalPrice - marketPrice;
                    edgePercent = (edge / marketPrice) * 100;
                }
                // Sell option: option is overpriced (IV is higher than HV by at least 12% absolute, and BS price is lower)
                else if (IV > HV + 0.12 && marketPrice > theoreticalPrice * 1.20) {
                    action = "SELL";
                    edge = marketPrice - theoreticalPrice;
                    edgePercent = (edge / marketPrice) * 100;
                }

                // Push opportunity if edge percent exceeds a reasonable 12% threshold
                if (action && edgePercent > 12) {
                    const formattedExpiry = new Date(expirationStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                    const strikeLabel = `$${K} ${contract.type}`;
                    const desc = action === "BUY"
                        ? `Volatility is underpriced. IV is ${(IV * 100).toFixed(0)}% vs Historical realized volatility of ${(HV * 100).toFixed(0)}%. Option trading at a ${(edgePercent).toFixed(0)}% discount.`
                        : `Volatility is overpriced. IV is ${(IV * 100).toFixed(0)}% vs Historical realized volatility of ${(HV * 100).toFixed(0)}%. Selling credit/premium offers a ${(edgePercent).toFixed(0)}% edge.`;

                    opportunities.push({
                        symbol,
                        contractSymbol: contract.contractSymbol,
                        type: contract.type,
                        strike: K,
                        expiration: expirationStr,
                        marketPrice: parseFloat(marketPrice.toFixed(2)),
                        theoreticalPrice: parseFloat(theoreticalPrice.toFixed(2)),
                        iv: parseFloat((IV * 100).toFixed(1)),
                        hv: parseFloat((HV * 100).toFixed(1)),
                        edge: parseFloat(edge.toFixed(2)),
                        edgePercent: parseFloat(edgePercent.toFixed(1)),
                        action,
                        volume: contract.volume || 0,
                        openInterest: contract.openInterest || 0,
                        description: desc
                    });
                }
            }
        }
    } catch (err) {
        console.warn(`[Profitable Scanner] Error scanning ticker ${symbol}:`, err);
    }
    return opportunities;
}
