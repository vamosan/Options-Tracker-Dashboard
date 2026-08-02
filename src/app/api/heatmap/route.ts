import { NextResponse } from 'next/server';

export async function GET() {
    const topTickers = ["NVDA", "TSLA", "AAPL", "AMD", "SPY", "QQQ", "AMZN", "MSFT", "META", "GOOGL"];
    const finnhubKey = process.env.Finnhub_API_Key || "d69m4lhr01qhe6mo0g6gd69m4lhr01qhe6mo0g70";

    try {
        const promises = topTickers.map(async (symbol) => {
            const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`, {
                next: { revalidate: 15 } // Cache for 15 seconds to avoid rate limits
            });
            if (!res.ok) throw new Error(`Finnhub error for ${symbol}`);
            const data = await res.json();
            return {
                symbol,
                price: data.c || 0,
                change: data.d || 0,
                changePercent: data.dp || 0
            };
        });

        const tickerData = await Promise.all(promises);

        return NextResponse.json(tickerData);

    } catch (error: any) {
        console.error("Heatmap API fetch failed:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch quotes" }, { status: 500 });
    }
}
