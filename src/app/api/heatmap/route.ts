import yahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';

export async function GET() {
    const topTickers = ["NVDA", "TSLA", "AAPL", "AMD", "SPY", "QQQ", "AMZN", "MSFT", "META", "GOOGL"];

    try {
        let yf = yahooFinance;
        if (typeof yf === 'function') {
            yf = new (yf as any)();
        }

        if (!yf || typeof yf.quote !== 'function') {
            return NextResponse.json({ error: "Yahoo Finance library failed to load" }, { status: 500 });
        }

        // Create a 5-second timeout promise to prevent Vercel from hanging indefinitely
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Yahoo Finance request timed out")), 5000)
        );

        const quotes = await Promise.race([
            yf.quote(topTickers),
            timeoutPromise
        ]) as any[];

        const tickerData = quotes.map((quote: any) => ({
            symbol: quote.symbol,
            price: quote.regularMarketPrice || quote.price || quote.ask || quote.bid || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
        }));

        // Keep the original order
        const sortedData = topTickers
            .map(t => tickerData.find(d => d.symbol === t))
            .filter(Boolean);

        return NextResponse.json(sortedData);

    } catch (error: any) {
        console.error("Heatmap API fetch failed:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch quotes" }, { status: 500 });
    }
}
