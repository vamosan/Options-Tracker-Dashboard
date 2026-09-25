import { NextResponse } from 'next/server';

// Alpaca API configuration
const ALPACA_API_KEY = process.env.ALPACA_API_KEY || '';
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY || '';
const DATA_URL = 'https://data.alpaca.markets/v2';
const TRADING_URL = 'https://paper-api.alpaca.markets/v2';

const WATCHLIST = ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL', 'AMD'];

export async function POST() {
    try {
        const logs: string[] = [];
        const executedTrades = [];

        // 1. Fetch current time and determine if market is open
        const now = new Date();
        const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        
        logs.push(`[${estTime.toLocaleTimeString()}] Initiating scan sequence across ${WATCHLIST.length} tickers...`);

        // Get today's date in YYYY-MM-DD
        const todayStr = estTime.toISOString().split('T')[0];

        // 2. Fetch 1-minute bars for the watchlist to calculate the 5-min ORB (9:30 - 9:35 AM)
        const barsRes = await fetch(`${DATA_URL}/stocks/bars?symbols=${WATCHLIST.join(',')}&timeframe=1Min&start=${todayStr}T09:30:00Z&end=${todayStr}T16:00:00Z&limit=1000`, {
            headers: {
                'APCA-API-KEY-ID': ALPACA_API_KEY,
                'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY,
                'Accept': 'application/json'
            }
        });

        if (!barsRes.ok) {
            logs.push(`[ERROR] Failed to fetch market data from Alpaca: ${barsRes.statusText}`);
            return NextResponse.json({ logs, trades: [] });
        }

        const barsData = await barsRes.json();
        
        // 3. Process ORB for each ticker
        for (const symbol of WATCHLIST) {
            const bars = barsData.bars?.[symbol] || [];
            if (bars.length < 5) {
                logs.push(`[WAIT] ${symbol}: Waiting for 5-minute Opening Range to form (Not enough data yet).`);
                continue;
            }

            // Calculate 9:30 - 9:35 High/Low
            const orbBars = bars.slice(0, 5);
            const orbHigh = Math.max(...orbBars.map((b: any) => b.h));
            const orbLow = Math.min(...orbBars.map((b: any) => b.l));
            
            const currentBar = bars[bars.length - 1];
            const currentPrice = currentBar.c;

            // Check for breakout
            if (currentPrice > orbHigh) {
                logs.push(`[ALERT] ${symbol} broke ORB High ($${orbHigh.toFixed(2)}). Current: $${currentPrice.toFixed(2)}`);
                // Check if we already have an open position for this
                // (In a full prod app, we'd query Alpaca for open positions)
                
                // For demonstration, we just log the signal.
            } else if (currentPrice < orbLow) {
                logs.push(`[ALERT] ${symbol} broke ORB Low ($${orbLow.toFixed(2)}). Current: $${currentPrice.toFixed(2)}`);
            } else {
                logs.push(`[SCAN] ${symbol} is trading inside the ORB ($${orbLow.toFixed(2)} - $${orbHigh.toFixed(2)}).`);
            }
        }

        // 4. Return results to the UI
        return NextResponse.json({
            logs,
            trades: executedTrades,
            timestamp: estTime.toISOString()
        });

    } catch (error: any) {
        return NextResponse.json({ logs: [`[CRITICAL ERROR] ${error.message}`], trades: [] }, { status: 500 });
    }
}
