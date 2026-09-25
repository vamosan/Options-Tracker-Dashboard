import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

const ALPACA_API_KEY = process.env.ALPACA_API_KEY || '';
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY || '';
const DATA_URL = 'https://data.alpaca.markets/v2';

export async function POST() {
    try {
        const logs: string[] = [];
        const executedTrades = [];
        const now = new Date();
        const estTime = new Date(now.toLocaleString('en-US', {timeZone: 'America/New_York'}));
        const todayStr = estTime.toISOString().split('T')[0];
        
        logs.push(`[` + estTime.toLocaleTimeString() + `] Initiating strict Level 2 Discovery Pipeline...`);

        // 1. Strict Pre-Market Discovery Filters
        // Scan for Day Gainers
        const screenerRes = await yahooFinance.screener({ scrIds: 'day_gainers', count: 25 });
        const quotes = screenerRes.quotes || [];
        
        const qualifiedTickers = [];
        
        for (const q of quotes) {
            const marketCap = q.marketCap || 0;
            const volume = q.regularMarketVolume || 0;
            const avgVolume = q.averageDailyVolume3Month || 1;
            const rvol = volume / avgVolume;
            
            // $10B+ Cap & RVOL > 2.0x
            if (marketCap >= 10000000000 && rvol > 2.0) {
                qualifiedTickers.push(q.symbol);
                logs.push(`[DISCOVERY] ${q.symbol} passed strict criteria (Cap: $${(marketCap/1e9).toFixed(1)}B, RVOL: ${rvol.toFixed(2)}x)`);
            }
        }
        
        if (qualifiedTickers.length === 0) {
            logs.push(`[DISCOVERY] No equities met the strict $10B+ / 2.0x RVOL threshold today.`);
            return NextResponse.json({ logs, trades: [] });
        }
        
        // 2. Liquidity & Options Chain Filtering
        const actionableContracts = [];
        for (const symbol of qualifiedTickers) {
            try {
                // Fetch option chain
                const options = await yahooFinance.options(symbol);
                if (!options || !options.options || options.options.length === 0) continue;
                
                const nearestExpiry = options.options[0];
                const calls = nearestExpiry.calls || [];
                
                // Filter for $1.20 - $3.50 premium and Penny-to-Nickel spread
                for (const call of calls) {
                    const ask = call.ask || 0;
                    const bid = call.bid || 0;
                    const spread = ask - bid;
                    
                    if (ask >= 1.20 && ask <= 3.50 && spread > 0 && spread <= 0.05) {
                        actionableContracts.push({
                            underlying: symbol,
                            contract: call.contractSymbol,
                            strike: call.strike,
                            ask: ask,
                            spread: spread
                        });
                        logs.push(`[LIQUIDITY] ${symbol} Call ${call.strike}C passed (Ask: $${ask}, Spread: $${spread.toFixed(2)})`);
                        break; // Only track one contract per symbol to avoid spam
                    }
                }
            } catch (e) {
                // Ignore options fetching errors for specific symbols
            }
        }
        
        if (actionableContracts.length === 0) {
            logs.push(`[LIQUIDITY] No options chains met the $1.20-$3.50 premium and <$0.05 spread criteria.`);
            return NextResponse.json({ logs, trades: [] });
        }
        
        // 3. 5-Minute ORB Execution via Alpaca
        const activeSymbols = actionableContracts.map(c => c.underlying);
        logs.push(`[ORB SYNC] Polling 1-min data for ${activeSymbols.join(', ')}...`);
        
        const barsRes = await fetch(`${DATA_URL}/stocks/bars?symbols=${activeSymbols.join(',')}&timeframe=1Min&start=${todayStr}T09:30:00Z&end=${todayStr}T16:00:00Z&limit=1000`, {
            headers: {
                'APCA-API-KEY-ID': ALPACA_API_KEY,
                'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY,
                'Accept': 'application/json'
            }
        });

        if (barsRes.ok) {
            const barsData = await barsRes.json();
            for (const contract of actionableContracts) {
                const symbol = contract.underlying;
                const bars = barsData.bars?.[symbol] || [];
                
                if (bars.length < 5) {
                    logs.push(`[WAIT] ${symbol}: ORB forming (needs 5 mins).`);
                    continue;
                }
                
                const orbBars = bars.slice(0, 5);
                const orbHigh = Math.max(...orbBars.map((b: any) => b.h));
                const orbLow = Math.min(...orbBars.map((b: any) => b.l));
                
                const currentBar = bars[bars.length - 1];
                const currentPrice = currentBar.c;
                
                if (currentPrice > orbHigh) {
                    logs.push(`[EXECUTE] ${symbol} BREAKOUT > $${orbHigh.toFixed(2)}. Triggering ENTRY on ${contract.contractSymbol} at $${contract.ask}. Stop-Loss shelf mapped to $${orbLow.toFixed(2)}.`);
                    
                    executedTrades.push({
                        id: Math.random().toString(36).substring(7),
                        symbol: contract.contractSymbol,
                        type: 'CALL',
                        entryTime: new Date().toLocaleTimeString(),
                        entryPrice: contract.ask,
                        qty: 5,
                        stopLoss: orbLow, // Map strict stop-loss shelf to the range extreme as requested
                        status: 'OPEN',
                        rationale: 'ORB Breakout > ' + orbHigh.toFixed(2)
                    });
                } else if (currentPrice < orbLow) {
                    logs.push(`[ALERT] ${symbol} BROKE DOWN < $${orbLow.toFixed(2)}. Abandoning long setup.`);
                } else {
                    logs.push(`[MONITOR] ${symbol} inside ORB bounds ($${orbLow.toFixed(2)} - $${orbHigh.toFixed(2)}).`);
                }
            }
        }
        
        return NextResponse.json({
            logs,
            trades: executedTrades,
            timestamp: estTime.toISOString()
        });

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ logs: [`[CRITICAL ERROR] ${error.message}`], trades: [] }, { status: 500 });
    }
}
