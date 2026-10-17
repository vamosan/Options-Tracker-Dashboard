import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { fetchAlpacaStockSnapshots } from '@/lib/alpacaClient';

// 4-second memory cache for high-frequency polling
const quoteCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL_MS = 4 * 1000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbolParam =
      searchParams.get('symbol') ||
      searchParams.get('symbols') ||
      'NVDA,CVS,META,AMD,CRWD,PLTR,LLY,TSLA,AAPL,MSFT,AMZN,AVGO,SPY,QQQ';
    const symbols = symbolParam
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const now = Date.now();
    const result: Record<string, any> = {};
    const uncachedSymbols: string[] = [];

    for (const sym of symbols) {
      const cached = quoteCache[sym];
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        result[sym] = cached.data;
      } else {
        uncachedSymbols.push(sym);
      }
    }

    if (uncachedSymbols.length > 0) {
      // 1. Primary Real-Time Source: Alpaca Market Data v2 Snapshots (Tick-by-Tick + True Intraday VWAP)
      const alpacaSnaps = await fetchAlpacaStockSnapshots(uncachedSymbols);
      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const missingForYahoo: string[] = [];

      for (const sym of uncachedSymbols) {
        const snap = alpacaSnaps[sym];
        if (snap && snap.price > 0) {
          const data = {
            symbol: sym,
            price: snap.price,
            change: snap.change,
            changePercent: snap.changePercent,
            dayHigh: snap.high,
            dayLow: snap.low,
            open: snap.open,
            dayOpen: snap.open,
            prevClose: snap.prevClose,
            volume: snap.volume,
            vwap: snap.vwap,
            source: 'alpaca-realtime',
            time: timeStr,
            timestamp: now,
          };
          quoteCache[sym] = { data, timestamp: now };
          result[sym] = data;
        } else {
          missingForYahoo.push(sym);
        }
      }

      // 2. Secondary Fallback: Yahoo Finance (for ^GSPC, ^VIX, or any symbol not in Alpaca snapshot)
      if (missingForYahoo.length > 0) {
        const yf = new (YahooFinance as any)({
          suppressNotices: ['yahooSurvey'],
        });
        await Promise.all(
          missingForYahoo.map(async (sym) => {
            try {
              const q = await yf.quote(sym);
              if (q && typeof q.regularMarketPrice === 'number') {
                const data = {
                  symbol: sym,
                  price: q.regularMarketPrice,
                  change: q.regularMarketChange || 0,
                  changePercent: q.regularMarketChangePercent || 0,
                  dayHigh:
                    q.regularMarketDayHigh || q.regularMarketPrice * 1.01,
                  dayLow: q.regularMarketDayLow || q.regularMarketPrice * 0.99,
                  dayOpen: q.regularMarketOpen || q.regularMarketPreviousClose || q.regularMarketPrice,
                  prevClose:
                    q.regularMarketPreviousClose || q.regularMarketPrice,
                  volume: q.regularMarketVolume || 0,
                  vwap: q.regularMarketPrice,
                  source: 'yahoo',
                  time: timeStr,
                  timestamp: now,
                };
                quoteCache[sym] = { data, timestamp: now };
                result[sym] = data;
              }
            } catch (e: any) {
              if (quoteCache[sym]) {
                result[sym] = quoteCache[sym].data;
              }
            }
          })
        );
      }
    }

    return NextResponse.json({
      success: true,
      source: 'alpaca-primary',
      quotes: result,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[LiveQuote API] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
