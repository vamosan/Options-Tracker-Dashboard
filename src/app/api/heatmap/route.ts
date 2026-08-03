import { NextResponse } from 'next/server';

export async function GET() {
    const topTickers = ["NVDA", "TSLA", "AAPL", "AMD", "SPY", "QQQ", "AMZN", "MSFT", "META", "GOOGL"];
    const finnhubKey = process.env.Finnhub_API_Key || "d69m4lhr01qhe6mo0g6gd69m4lhr01qhe6mo0g70";

    try {
        // Fetch sequentially to avoid Finnhub rate limits and connection timeouts
        const tickerData = [];
        for (const symbol of topTickers) {
            try {
                const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`, {
                    next: { revalidate: 15 }
                });
                if (res.ok) {
                    const data = await res.json();
                    tickerData.push({
                        symbol,
                        price: data.c || 0,
                        change: data.d || 0,
                        changePercent: data.dp || 0
                    });
                }
                // Add a small 100ms delay to avoid rate limit spikes
                await new Promise(r => setTimeout(r, 100));
            } catch (err) {
                console.error(`Failed to fetch ${symbol}:`, err);
            }
        }

        return NextResponse.json(tickerData);

    } catch (error: any) {
        console.error("Heatmap API fetch failed:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch quotes" }, { status: 500 });
    }
}
