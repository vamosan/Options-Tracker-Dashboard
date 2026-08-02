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
                                    const bid = opt.bid || 0;
                                    const ask = opt.ask || 0;
                                    const lastPrice = opt.lastPrice || ((bid + ask) / 2) || 0;
                                    
                                    const premiumTraded = volume * lastPrice * 100;
                                    const premiumPositioned = oi * lastPrice * 100;
                                    
                                    const isBlockTrade = premiumTraded >= 100000;
                                    const isWhalePosition = premiumPositioned >= 250000;

                                    if ((isBlockTrade || isWhalePosition)) {
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
        return NextResponse.json(allFlows.slice(0, 25));
    } catch (error) {
        console.error("Institutional Flow Scanner Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
