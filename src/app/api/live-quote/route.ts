import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

// 5-second memory cache for high-frequency polling
const quoteCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL_MS = 5 * 1000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbolParam = searchParams.get('symbol') || searchParams.get('symbols') || 'NVDA,CVS,META,AMD,CRWD,PLTR,LLY,SPY,QQQ';
    const symbols = symbolParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });
    const now = Date.now();
    const result: Record<string, any> = {};

    await Promise.all(
      symbols.map(async (sym) => {
        const cached = quoteCache[sym];
        if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
          result[sym] = cached.data;
          return;
        }

        try {
          const q = await yf.quote(sym);
          if (q && typeof q.regularMarketPrice === 'number') {
            const data = {
              symbol: sym,
              price: q.regularMarketPrice,
              change: q.regularMarketChange || 0,
              changePercent: q.regularMarketChangePercent || 0,
              dayHigh: q.regularMarketDayHigh || q.regularMarketPrice * 1.01,
              dayLow: q.regularMarketDayLow || q.regularMarketPrice * 0.99,
              prevClose: q.regularMarketPreviousClose || q.regularMarketPrice,
              volume: q.regularMarketVolume || 0,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              timestamp: now
            };
            quoteCache[sym] = { data, timestamp: now };
            result[sym] = data;
          }
        } catch (e: any) {
          console.warn(`[LiveQuote API] Failed for ${sym}:`, e.message);
          if (cached) {
            result[sym] = cached.data;
          }
        }
      })
    );

    return NextResponse.json({
      success: true,
      quotes: result,
      serverTime: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[LiveQuote API] Fatal error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
