import { Position } from "./types";

export function getRecommendation(position: Position) {
    const today = new Date();
    const expiry = new Date(position.expiration);
    const daysToExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Safety check for math
    const costBasis = position.premium * position.quantity * 100;
    const returnPercent = costBasis !== 0 ? (position.pl / costBasis) * 100 : 0;

    // Advanced Data Maps
    const marketIntel: Record<string, { sentiment: string; news: string; events: { name: string; date: string }[]; volatility: { gamma: string; signal: string } }> = {
        "SPY": {
            sentiment: "Bullish",
            news: "Core PCE data suggests cooling inflation.",
            events: [{ name: "FOMC Meeting", date: "2024-03-20" }, { name: "CPI Release", date: "2024-03-12" }],
            volatility: { gamma: "Neutral", signal: "Low Vol" }
        },
        "QQQ": {
            sentiment: "Neutral",
            news: "Tech sector showing signs of overextension.",
            events: [{ name: "NVDA Earnings", date: "2024-02-21" }, { name: "Tech Summit", date: "2024-02-28" }],
            volatility: { gamma: "Moderate", signal: "Mean Reversion" }
        },
        "NVDA": {
            sentiment: "Bullish",
            news: "H100 demand remains robust.",
            events: [{ name: "Earnings", date: "2024-02-21" }, { name: "GTC Conference", date: "2024-03-18" }],
            volatility: { gamma: "High (Squeeze Potential)", signal: "Potential Jump" }
        },
        "TSLA": {
            sentiment: "Bearish",
            news: "Inventory build-up concerns.",
            events: [{ name: "Delivery Report", date: "2024-04-02" }],
            volatility: { gamma: "Low", signal: "Potential Nosedive" }
        },
        "DEFAULT": {
            sentiment: "Neutral",
            news: "Broader market trading in range.",
            events: [{ name: "Macro Update", date: "2024-02-28" }],
            volatility: { gamma: "Low", signal: "Stable" }
        }
    };

    const intel = marketIntel[position.symbol] || marketIntel["DEFAULT"];

    // Gamma Squeeze / Jump Logic
    let signalOverride = "";
    let overrideColor = "";

    if (intel.volatility.gamma.includes("High")) {
        signalOverride = "GAMMA ALERT";
        overrideColor = "purple";
    } else if (intel.volatility.signal === "Potential Jump") {
        signalOverride = "JUMP SIGNAL";
        overrideColor = "emerald";
    } else if (intel.volatility.signal === "Potential Nosedive") {
        signalOverride = "NOSEDIVE RISK";
        overrideColor = "rose";
    }

    if (returnPercent >= 60) {
        return { signal: signalOverride || "MAX PROFIT", color: overrideColor || "green", advice: `Lock in ${returnPercent.toFixed(1)}% gain now.`, risk: "Low", confidence: 96, intel };
    } else if (returnPercent >= 30 && intel.sentiment === "Bearish" && position.type === "Call") {
        return { signal: signalOverride || "MACRO EXIT", color: overrideColor || "orange", advice: `Macro risk detected in ${position.symbol}.`, risk: "High", confidence: 88, intel };
    } else if (daysToExpiry <= 2 && returnPercent < 0) {
        return { signal: signalOverride || "TIME EXIT", color: overrideColor || "red", advice: "Theta decay accelerating. Cut loss.", risk: "Extreme", confidence: 94, intel };
    } else if (returnPercent <= -45) {
        return { signal: signalOverride || "STOP LOSS", color: overrideColor || "red", advice: "Hard stop-loss reached.", risk: "High", confidence: 90, intel };
    } else if (returnPercent > 10 && intel.sentiment === "Bullish" && position.type === "Call") {
        return { signal: signalOverride || "RIDE TREND", color: overrideColor || "green", advice: "Sentiment supports further upside.", risk: "Medium", confidence: 82, intel };
    } else {
        return { signal: signalOverride || "SECURE HOLD", color: overrideColor || "cyan", advice: "Consolidating. No exit signal.", risk: "Low", confidence: 70, intel };
    }
}
export function generateDynamicOpportunities(marketData: Record<string, { price: number; change: number; changePercent: number }>) {
    const opportunities = [];

    for (const [symbol, data] of Object.entries(marketData)) {
        // 1. RSI Proxy: Oversold Dip Buy
        if (data.changePercent <= -2.0) {
            opportunities.push({
                symbol: symbol,
                type: "Call",
                strategy: "Oversold Bounce",
                confidence: 80 + Math.abs(data.changePercent), // Higher drop = higher confidence
                reasoning: `${symbol} is down ${data.changePercent.toFixed(2)}% today to $${data.price.toFixed(2)}. Technicals suggest it is oversold short-term and due for a mean-reversion bounce.`,
                risk: "Catching a falling knife",
                target: `$${(data.price * 1.02).toFixed(0)} Call`
            });
        }
        // 2. RSI Proxy: Overbought Fade
        else if (data.changePercent >= 2.5) {
            opportunities.push({
                symbol: symbol,
                type: "Put",
                strategy: "Overextension Fade",
                confidence: 75,
                reasoning: `${symbol} has surged ${data.changePercent.toFixed(2)}% to $${data.price.toFixed(2)}. RSI likely overextended (>70). Expecting profit taking or a cool-off pullback.`,
                risk: "Fighting strong momentum",
                target: `$${(data.price * 0.97).toFixed(0)} Put`
            });
        }
        // 3. Momentum Continuation
        else if (data.changePercent > 0.8 && data.changePercent < 2.0) {
            opportunities.push({
                symbol: symbol,
                type: "Call",
                strategy: "Momentum Ride",
                confidence: 72,
                reasoning: `${symbol} is showing steady strength (+${data.changePercent.toFixed(2)}%). Price action indicates healthy accumulation without climatic exhaustion.`,
                risk: "Choppy consolidation",
                target: `$${(data.price * 1.01).toFixed(0)} Call`
            });
        }
    }

    // Sort by confidence
    return opportunities.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}
