import { NextResponse } from 'next/server';
import { runAgenticAnalysis } from '../../agenticActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        // 1. Fetch Top Movers (Yahoo Finance Pre-defined screener)
        const yahooRes = await fetch('https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=true&lang=en-US&region=US&scrIds=day_gainers&count=10', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 60 }
        });
        
        const yahooData = await yahooRes.json();
        const quotes = yahooData?.finance?.result?.[0]?.quotes || [];
        
        // Take top 5 to avoid long execution times
        const topSymbols = quotes.slice(0, 5).map((q: any) => q.symbol);
        
        const results = [];
        const finnhubKey = process.env.Finnhub_API_Key || 'd69m4lhr01qhe6mo0g6gd69m4lhr01qhe6mo0g70';
        
        for (const symbol of topSymbols) {
            // 2. Fetch Catalyst (Company News from Finnhub)
            const today = new Date();
            const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            const to = today.toISOString().split('T')[0];
            const from = lastWeek.toISOString().split('T')[0];
            
            let catalyst = null;
            try {
                const newsRes = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${finnhubKey}`);
                const news = await newsRes.json();
                if (news && news.length > 0) {
                    catalyst = news[0]; // Take the most recent news
                }
            } catch (e) {
                console.error("Finnhub error for", symbol);
            }
            
            // 3. Score Breakout Potential
            let scoreData = null;
            try {
                // Returns real python score or Vercel mock
                scoreData = await runAgenticAnalysis(symbol);
            } catch (e) {
                console.error("Agentic error for", symbol);
            }
            
            // Add quote info
            const quote = quotes.find((q: any) => q.symbol === symbol);
            
            results.push({
                symbol,
                changePercent: quote?.regularMarketChangePercent?.raw || 0,
                price: quote?.regularMarketPrice?.raw || 0,
                volume: quote?.regularMarketVolume?.raw || 0,
                catalyst: catalyst ? {
                    headline: catalyst.headline,
                    url: catalyst.url,
                    source: catalyst.source,
                    time: new Date(catalyst.datetime * 1000).toLocaleString()
                } : null,
                score: scoreData
            });
            
            // Artificial delay to prevent Finnhub rate limits (60/min)
            await new Promise(r => setTimeout(r, 200));
        }

        return NextResponse.json({ success: true, data: results });
        
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
