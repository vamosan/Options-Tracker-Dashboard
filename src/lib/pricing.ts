import { Trade } from "./types";

// Mock Black-Scholes-ish calculator
// In a real app, this would fetch data or use a library like 'black-scholes'
export const calculateOptionPrice = (
    trade: Trade,
    currentStockPrice: number,
    volatility: number = 0.2,
    riskFreeRate: number = 0.05
): number => {
    const timeToExpiry =
        (new Date(trade.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365);

    if (timeToExpiry <= 0) {
        // Expired
        if (trade.type === "Call") return Math.max(0, currentStockPrice - trade.strike);
        return Math.max(0, trade.strike - currentStockPrice);
    }

    // Simple simulation: Intrinsic Value + Time Value
    // This is NOT accurate Black-Scholes, but sufficient for a visual mock
    const intrinsic =
        trade.type === "Call"
            ? Math.max(0, currentStockPrice - trade.strike)
            : Math.max(0, trade.strike - currentStockPrice);

    // Fake time value decay
    const timeValue = (currentStockPrice * volatility * Math.sqrt(Math.max(0, timeToExpiry))) / 5;

    return intrinsic + timeValue;
};

export const getMarketPrice = (symbol: string): number => {
    // Mock current stock price based on symbol hash to keep it consistent-ish but random
    const basePrice = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    // Add some random fluctuation
    const fluctuation = (Math.sin(Date.now() / 10000) * 5) + (Math.random() * 2 - 1);
    return Math.abs(basePrice % 500) + 100 + fluctuation;
};
