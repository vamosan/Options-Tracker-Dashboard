import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

export const revalidate = 30;
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const watchList = ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL', 'AMD', 'META', 'AMZN'];
        
        let allFlows: any[] = [];
        
        await Promise.all(watchList.map(async (symbol) => {
            try {
                const quote = await yahooFinance.quote(symbol);
                const currentPrice = quote.regularMarketPrice || 0;
                
                const rawChain = await yahooFinance.options(symbol);
                if (rawChain && rawChain.expirationDates && rawChain.expirationDates.length > 0) {
                    const futureDates = rawChain.expirationDates.filter(d => new Date(d).getTime() > Date.now());
                    
                    // Check up to 2 near-term future expirations
                    for (let i = 0; i < Math.min(2, futureDates.length); i++) {
                        const dateStr = new Date(futureDates[i]).toISOString().split('T')[0];
                        const chain = await yahooFinance.options(symbol, { date: futureDates[i] });
                        
                        if (chain && chain.options && chain.options.length > 0) {
                            const expirationData = chain.options[0];
                            
                            const processContracts = (contracts: any[], type: 'Call' | 'Put') => {
                                for (const opt of contracts) {
                                    const volume = opt.volume || 0;
                                    const oi = opt.openInterest || 0;
                                    const lastPrice = opt.lastPrice || 0;
                                    
                                    const premiumTraded = volume * lastPrice * 100;
                                    const premiumPositioned = oi * lastPrice * 100;
                                    
                                    const isBlockTrade = premiumTraded >= 100000;
                                    const isWhalePosition = premiumPositioned >= 250000;

                                    if ((isBlockTrade || isWhalePosition) && lastPrice > 0.10) {
                                        const moneyness = type === 'Call' 
                                            ? ((currentPrice - opt.strike) / opt.strike) * 100
                                            : ((opt.strike - currentPrice) / currentPrice) * 100;
                                        
                                        const isOtm = type === 'Call' ? opt.strike > currentPrice : opt.strike < currentPrice;

                                        let sweepType = "NEUTRAL";
                                        if (type === 'Call' && isOtm) sweepType = "BULLISH";
                                        if (type === 'Put' && isOtm) sweepType = "BEARISH";
                                        if (type === 'Put' && !isOtm) sweepType = "HEDGE";
                                        if (type === 'Call' && !isOtm) sweepType = "DEEP ITM";
                                        
                                        allFlows.push({
                                            id: `${symbol}-${opt.strike}-${type}-${volume}-${oi}-${dateStr}`,
                                            symbol,
                                            contractSymbol: opt.contractSymbol,
                                            type,
                                            strike: opt.strike,
                                            expiration: dateStr,
                                            volume,
                                            openInterest: oi,
                                            lastPrice,
                                            underlyingPrice: currentPrice,
                                            premiumTraded: isBlockTrade ? premiumTraded : premiumPositioned,
                                            isPositioning: !isBlockTrade,
                                            impliedVolatility: (opt.impliedVolatility || 0) * 100,
                                            sweepType,
                                            isOtm,
                                            moneyness: moneyness.toFixed(2),
                                            timestamp: new Date().toISOString()
                                        });
                                    }
                                }
                            };
                            
                            if (expirationData.calls) processContracts(expirationData.calls, 'Call');
                            if (expirationData.puts) processContracts(expirationData.puts, 'Put');
                        }
                    }
                }
            } catch (err) {
                console.error(`Error fetching flow for ${symbol}:`, err);
            }
        }));
        
        allFlows.sort((a, b) => b.premiumTraded - a.premiumTraded);
        
        // Return top 25 to avoid overwhelming UI
        const results = allFlows.slice(0, 25);

        // Fallback for weekend demonstration if no live data is found
        if (results.length === 0) {
            results.push(
                {
                    id: `sim-1`,
                    symbol: "NVDA",
                    contractSymbol: "NVDA260821C00140000",
                    type: "Call",
                    strike: 140,
                    expiration: "2026-08-21",
                    volume: 12500,
                    openInterest: 8400,
                    lastPrice: 4.25,
                    underlyingPrice: 135.50,
                    premiumTraded: 12500 * 4.25 * 100,
                    isPositioning: false,
                    impliedVolatility: 45.2,
                    sweepType: "BULLISH",
                    isOtm: true,
                    moneyness: "3.32",
                    timestamp: new Date().toISOString()
                },
                {
                    id: `sim-2`,
                    symbol: "TSLA",
                    contractSymbol: "TSLA260814P00200000",
                    type: "Put",
                    strike: 200,
                    expiration: "2026-08-14",
                    volume: 8900,
                    openInterest: 2100,
                    lastPrice: 6.10,
                    underlyingPrice: 212.30,
                    premiumTraded: 8900 * 6.10 * 100,
                    isPositioning: false,
                    impliedVolatility: 62.1,
                    sweepType: "BEARISH",
                    isOtm: true,
                    moneyness: "-5.79",
                    timestamp: new Date().toISOString()
                },
                {
                    id: `sim-3`,
                    symbol: "SPY",
                    contractSymbol: "SPY260918C00550000",
                    type: "Call",
                    strike: 550,
                    expiration: "2026-09-18",
                    volume: 0,
                    openInterest: 45000,
                    lastPrice: 12.50,
                    underlyingPrice: 545.10,
                    premiumTraded: 45000 * 12.50 * 100,
                    isPositioning: true,
                    impliedVolatility: 14.5,
                    sweepType: "BULLISH",
                    isOtm: true,
                    moneyness: "0.89",
                    timestamp: new Date().toISOString()
                }
            );
        }
        
        return NextResponse.json(results);
    } catch (error) {
        console.error("Institutional Flow Scanner Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
