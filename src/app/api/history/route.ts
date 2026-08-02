import yahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';
import { subDays } from 'date-fns';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const timeframe = searchParams.get('timeframe') || '30d';

    if (!symbol) {
        return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }

    try {
        let yf = yahooFinance;
        if (typeof yf === 'function') {
            yf = new (yf as any)();
        }

        const endDate = new Date();
        let startDate = subDays(endDate, 30);
        let interval: "1m" | "2m" | "5m" | "15m" | "30m" | "60m" | "90m" | "1h" | "1d" | "5d" | "1wk" | "1mo" | "3mo" = '1d';

        if (timeframe === '1d') {
            startDate = subDays(endDate, 3);
            interval = '15m';
        } else if (timeframe === '1w') {
            startDate = subDays(endDate, 7);
            interval = '60m';
        } else {
            // Need ~250 days for a valid SMA-200
            startDate = subDays(endDate, 250);
            interval = '1d';
        }

        const result = await yf.chart(symbol, {
            period1: startDate,
            period2: endDate,
            interval: interval as any
        });

        const yfResult = result as any;
        if (!yfResult || !yfResult.quotes) {
            return NextResponse.json({ error: "No historical data found" }, { status: 404 });
        }

        // --- Technical Indicators Helper ---
        const prices = yfResult.quotes.map((q: any) => q.close || q.adjclose || 0).filter((p: number) => p > 0);

        const calculateSMA = (data: number[], window: number) => {
            if (data.length < window) return Array(data.length).fill(null);
            return data.map((_, i) => {
                if (i < window - 1) return null;
                const slice = data.slice(i - window + 1, i + 1);
                return slice.reduce((a, b) => a + b, 0) / window;
            });
        };

        const calculateRSI = (data: number[], window: number = 14) => {
            if (data.length <= window) return Array(data.length).fill(null);
            const rsis = Array(data.length).fill(null);
            let gains = 0, losses = 0;

            for (let i = 1; i < data.length; i++) {
                const diff = data[i] - data[i - 1];
                if (i <= window) {
                    if (diff > 0) gains += diff; else losses -= diff;
                    if (i === window) {
                        let rs = (gains / window) / (losses / window || 1);
                        rsis[i] = 100 - (100 / (1 + rs));
                    }
                } else {
                    const gain = diff > 0 ? diff : 0;
                    const loss = diff < 0 ? -diff : 0;
                    gains = (gains * (window - 1) + gain) / window;
                    losses = (losses * (window - 1) + loss) / window;
                    let rs = gains / (losses || 1);
                    rsis[i] = 100 - (100 / (1 + rs));
                }
            }
            return rsis;
        };

        const sma50 = calculateSMA(prices, 50);
        const sma200 = calculateSMA(prices, 200);
        const rsi = calculateRSI(prices, 14);
        // -----------------------------------

        let history = yfResult.quotes.map((quote: any, idx: number) => {
            const isIntraday = timeframe === '1d' || timeframe === '1w';
            let dateStr = quote.date;
            if (quote.date instanceof Date) {
                if (isIntraday) {
                    dateStr = quote.date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                } else {
                    dateStr = quote.date.toISOString().split('T')[0];
                }
            }

            return {
                date: dateStr,
                price: quote.close || quote.adjclose || 0,
                volume: quote.volume || 0,
                sma50: sma50[idx],
                sma200: sma200[idx],
                rsi: rsi[idx]
            };
        }).filter((q: any) => q.price > 0);

        // If timeframe is 30d, trim back to only 30 days of display data, 
        // but indicators are already calculated based on long history
        if (timeframe === '30d') {
            history = history.slice(-30);
        } else if (timeframe === '1w') {
            // Already limited by startDate
        }

        return NextResponse.json({
            symbol,
            history,
            currentPrice: yfResult.meta?.regularMarketPrice || 0,
            previousClose: yfResult.meta?.previousClose || 0,
        });

    } catch (error: any) {
        console.error(`History API fetch failed for ${symbol}:`, error);
        return NextResponse.json({ error: error.message || "Failed to fetch history" }, { status: 500 });
    }
}
