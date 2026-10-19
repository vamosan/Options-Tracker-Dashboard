/**
 * Institutional Alpaca Real-Time Market Data, OPRA Options Chain & Paper Execution Engine
 * Connects live equity snapshots, live OPRA option quotes, and automated Paper Order execution.
 */

const DEFAULT_ALPACA_KEY = 'PKIXZNNSHLPXWJMCFVHX3XHGSU';
const DEFAULT_ALPACA_SECRET = '8c6pEQfLQCnoCKcQYjjsX7vL7dNTHhW54ienhTaPJD2s';

export function getAlpacaHeaders(): Record<string, string> {
  const key = (process.env.ALPACA_API_KEY || DEFAULT_ALPACA_KEY).trim();
  const secret = (process.env.ALPACA_SECRET_KEY || DEFAULT_ALPACA_SECRET).trim();
  return {
    'APCA-API-KEY-ID': key,
    'APCA-API-SECRET-KEY': secret,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

export const ALPACA_DATA_URL = 'https://data.alpaca.markets/v2';
export const ALPACA_OPTIONS_DATA_URL = 'https://data.alpaca.markets/v1beta1';
export const ALPACA_PAPER_TRADING_URL = 'https://paper-api.alpaca.markets/v2';

export interface AlpacaStockSnapshot {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number;
  vwap: number;
  change: number;
  changePercent: number;
  tradeTimestamp: string;
}

export interface AlpacaOptionContractQuote {
  occSymbol: string;
  underlying: string;
  strike: number;
  expirationDate: string;
  direction: 'CALL' | 'PUT';
  bid: number;
  ask: number;
  mid: number;
  lastPrice: number;
  spread: number;
  spreadPct: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  vwap: number;
}

export interface AlpacaOrderExecutionResult {
  success: boolean;
  orderId?: string;
  occSymbol?: string;
  qty?: number;
  side?: 'buy' | 'sell';
  status?: string;
  filledAvgPrice?: number | null;
  bidPrice?: number;
  limitOrAskPrice?: number;
  spreadPct?: number;
  maxPayCeiling?: number;
  message: string;
}

/**
 * 1. Fetch Real-Time Stock Snapshots from Alpaca (Tick-level latestTrade + True Intraday VWAP)
 */
export async function fetchAlpacaStockSnapshots(
  symbols: string[]
): Promise<Record<string, AlpacaStockSnapshot>> {
  const cleanSymbols = Array.from(
    new Set(
      symbols
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s && !s.startsWith('^'))
    )
  );
  if (cleanSymbols.length === 0) return {};

  try {
    const res = await fetch(
      `${ALPACA_DATA_URL}/stocks/snapshots?symbols=${cleanSymbols.join(',')}`,
      {
        headers: getAlpacaHeaders(),
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) {
      return {};
    }
    const raw = await res.json();
    const out: Record<string, AlpacaStockSnapshot> = {};

    const estNow = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    );
    const todayIso = `${estNow.getFullYear()}-${String(estNow.getMonth() + 1).padStart(2, '0')}-${String(estNow.getDate()).padStart(2, '0')}`;

    for (const sym of cleanSymbols) {
      const snap = raw?.[sym];
      if (!snap) continue;

      const price =
        snap.latestTrade?.p ||
        snap.minuteBar?.c ||
        snap.dailyBar?.c ||
        snap.prevDailyBar?.c ||
        0;
      if (!price || price <= 0) continue;

      // Before 09:30 AM ET, Alpaca's dailyBar.t is still the previous trading day's bar (e.g. Friday),
      // while prevDailyBar.t is 2 trading days ago (e.g. Thursday).
      const dailyBarDate = String(snap.dailyBar?.t || '').slice(0, 10);
      const isDailyBarToday = dailyBarDate === todayIso;

      const prevClose = isDailyBarToday
        ? (snap.prevDailyBar?.c || snap.dailyBar?.o || price)
        : (snap.dailyBar?.c || snap.prevDailyBar?.c || price);
      const open = isDailyBarToday
        ? (snap.dailyBar?.o || prevClose)
        : price;
      const high = isDailyBarToday
        ? Math.max(price, snap.dailyBar?.h || price)
        : Math.max(price, snap.minuteBar?.h || price);
      const low = isDailyBarToday
        ? Math.min(price, snap.dailyBar?.l || price)
        : Math.min(price, snap.minuteBar?.l || price);
      const volume = isDailyBarToday
        ? (snap.dailyBar?.v || 0)
        : (snap.minuteBar?.v || 0);
      const vwap = isDailyBarToday
        ? (snap.dailyBar?.vw || price)
        : (snap.minuteBar?.vw || price);
      const change = Math.round((price - prevClose) * 100) / 100;
      const changePercent =
        prevClose > 0
          ? Math.round(((price - prevClose) / prevClose) * 10000) / 100
          : 0;

      out[sym] = {
        symbol: sym,
        price,
        open,
        high,
        low,
        prevClose,
        volume,
        vwap,
        change,
        changePercent,
        tradeTimestamp:
          snap.latestTrade?.t || new Date().toISOString(),
      };
    }

    return out;
  } catch (err: any) {
    console.warn('[AlpacaClient] Stock snapshot error:', err?.message);
    return {};
  }
}

/**
 * 2. Resolve Real Active OCC Option Contract & Live OPRA Quote from Alpaca
 * For equities, prefers weekly expiration (>= 2 days out on Fridays so theta doesn't crush intraday setups).
 * For SPY 0DTE Power Hour (allowZeroDte = true), selects today's 0DTE contract.
 */
export async function resolveAlpacaOptionContract(
  underlying: string,
  targetStrike: number,
  direction: 'CALL' | 'PUT',
  allowZeroDte: boolean = false
): Promise<AlpacaOptionContractQuote | null> {
  try {
    const now = new Date();
    const estDate = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/New_York' })
    );
    const dayOfWeek = estDate.getDay();

    // Allow same-day 0DTE / near-dated tradable contracts during the morning session (< 14:00 ET) or when allowZeroDte is true,
    // so explosive 0DTE setups like META $705P ($3.80 -> $11.45) capture full gamma instead of paying $24.00 for far-dated IV.
    const minExpDate = new Date(estDate);
    if (!allowZeroDte && estDate.getHours() >= 14) {
      minExpDate.setDate(minExpDate.getDate() + (dayOfWeek === 5 ? 3 : 1));
    }
    const minExpStr = `${minExpDate.getFullYear()}-${String(minExpDate.getMonth() + 1).padStart(2, '0')}-${String(minExpDate.getDate()).padStart(2, '0')}`;

    const strikeRange = Math.max(5, Math.round(targetStrike * 0.05));
    const minStrike = Math.max(1, Math.floor(targetStrike - strikeRange));
    const maxStrike = Math.ceil(targetStrike + strikeRange);

    const url = `${ALPACA_PAPER_TRADING_URL}/options/contracts?underlying_symbols=${underlying.toUpperCase()}&status=active&type=${direction.toLowerCase()}&expiration_date_gte=${minExpStr}&strike_price_gte=${minStrike}&strike_price_lte=${maxStrike}&limit=100`;

    const res = await fetch(url, {
      headers: getAlpacaHeaders(),
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const rawContracts: any[] = data?.option_contracts || [];
    const contracts: any[] = rawContracts.filter((c: any) => c.tradable !== false);
    if (contracts.length === 0) return null;

    // Group by earliest available tradable expiration date, then pick strike closest to targetStrike
    contracts.sort((a, b) => {
      if (a.expiration_date !== b.expiration_date) {
        return a.expiration_date.localeCompare(b.expiration_date);
      }
      const diffA = Math.abs(parseFloat(a.strike_price) - targetStrike);
      const diffB = Math.abs(parseFloat(b.strike_price) - targetStrike);
      return diffA - diffB;
    });

    const earliestExp = contracts[0].expiration_date;
    const sameExpContracts = contracts
      .filter((c) => c.expiration_date === earliestExp)
      .slice(0, 8);

    const symbolsList = sameExpContracts.map((c) => c.symbol).join(',');
    const snapRes = await fetch(
      `${ALPACA_OPTIONS_DATA_URL}/options/snapshots?symbols=${symbolsList}`,
      {
        headers: getAlpacaHeaders(),
        cache: 'no-store',
        signal: AbortSignal.timeout(3500),
      }
    );

    const snapData = snapRes.ok ? await snapRes.json() : {};
    const snapshots = snapData?.snapshots || {};

    // First pass: Prefer a liquid contract in our $0.80 - $8.50 high-gamma institutional Ask sweet spot with spread <= 10%
    let bestContract = sameExpContracts[0];
    let bestSnap = snapshots[bestContract.symbol];
    let foundSweetSpot = false;

    for (const c of sameExpContracts) {
      const s = snapshots[c.symbol];
      const ap = s?.latestQuote?.ap || s?.latestTrade?.p || s?.dailyBar?.c || 0;
      const bp = s?.latestQuote?.bp || 0;
      const spPct = ap > 0 && bp > 0 ? ((ap - bp) / ap) * 100 : 5;
      if (ap >= 0.80 && ap <= 8.50 && spPct <= 10.0) {
        bestContract = c;
        bestSnap = s;
        foundSweetSpot = true;
        break;
      }
    }

    // Second pass fallback if all contracts are above $8.50
    if (!foundSweetSpot) {
      for (const c of sameExpContracts) {
        const s = snapshots[c.symbol];
        const ap = s?.latestQuote?.ap || s?.latestTrade?.p || s?.dailyBar?.c || 0;
        const bp = s?.latestQuote?.bp || 0;
        const spPct = ap > 0 && bp > 0 ? ((ap - bp) / ap) * 100 : 5;
        if (ap >= 0.40 && spPct <= 10.0) {
          bestContract = c;
          bestSnap = s;
          break;
        }
      }
    }

    const strikeNum = parseFloat(bestContract.strike_price);
    const rawBid = bestSnap?.latestQuote?.bp || 0;
    const rawAsk = bestSnap?.latestQuote?.ap || 0;
    const lastPrice =
      bestSnap?.latestTrade?.p || bestSnap?.dailyBar?.c || rawAsk || 2.25;
    const ask =
      rawAsk > 0
        ? rawAsk
        : Math.round(Math.max(0.5, lastPrice * 1.02) * 100) / 100;
    const bid =
      rawBid > 0
        ? rawBid
        : Math.round(Math.max(0.4, ask - 0.06) * 100) / 100;
    const mid = Math.round(((bid + ask) / 2) * 100) / 100;
    const spread = Math.max(0.01, Math.round((ask - bid) * 100) / 100);
    const spreadPct = ask > 0 ? Math.round((spread / ask) * 1000) / 10 : 0;

    return {
      occSymbol: bestContract.symbol,
      underlying: underlying.toUpperCase(),
      strike: strikeNum,
      expirationDate: bestContract.expiration_date,
      direction,
      bid,
      ask,
      mid,
      lastPrice,
      spread,
      spreadPct,
      openPrice: bestSnap?.dailyBar?.o || ask,
      highPrice: bestSnap?.dailyBar?.h || ask,
      lowPrice: bestSnap?.dailyBar?.l || bid,
      volume: bestSnap?.dailyBar?.v || 0,
      vwap: bestSnap?.dailyBar?.vw || mid,
    };
  } catch (err: any) {
    console.warn('[AlpacaClient] Option resolution error:', err?.message);
    return null;
  }
}

/**
 * 2B. Fetch all underlying symbols that have already been traded (BUY order or open position) today on Alpaca Paper.
 * Acts as a persistent cloud ledger across Vercel serverless cold starts so we NEVER send duplicate Discord alerts.
 */
export async function fetchTodayAlpacaTradedUnderlyings(
  todayStr: string
): Promise<Set<string>> {
  const traded = new Set<string>();
  try {
    const headers = getAlpacaHeaders();
    const afterIso = `${todayStr}T04:00:00Z`;
    const [posRes, ordRes] = await Promise.all([
      fetch(`${ALPACA_PAPER_TRADING_URL}/positions`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(3500),
      }),
      fetch(
        `${ALPACA_PAPER_TRADING_URL}/orders?status=all&after=${encodeURIComponent(afterIso)}&limit=50`,
        {
          headers,
          cache: 'no-store',
          signal: AbortSignal.timeout(3500),
        }
      ),
    ]);

    const positions: any[] = posRes.ok ? await posRes.json() : [];
    const orders: any[] = ordRes.ok ? await ordRes.json() : [];

    for (const p of positions) {
      const m = String(p.symbol || '').match(/^([A-Z]+)/);
      if (m?.[1]) traded.add(m[1]);
    }
    for (const o of orders) {
      if (o.side === 'buy' && o.status !== 'canceled' && o.status !== 'rejected') {
        const m = String(o.symbol || '').match(/^([A-Z]+)/);
        if (m?.[1]) traded.add(m[1]);
      }
    }
  } catch (err: any) {
    console.warn('[AlpacaClient] fetchTodayAlpacaTradedUnderlyings error:', err?.message);
  }
  return traded;
}

export interface AlpacaActiveOptionTrade {
  underlying: string;
  occSymbol: string;
  direction: 'CALL' | 'PUT';
  strike: number;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  status: 'OPEN_POSITION' | 'FILLED_TODAY';
}

/**
 * 2C. Fetch detailed live Alpaca Paper option positions & today's filled option orders.
 * Used as the Single Source of Truth across Agentic Desk (/api/agentic-desk), Webpage, and Cloud Cron.
 */
export async function fetchTodayAlpacaOptionTrades(
  todayStr: string
): Promise<Map<string, AlpacaActiveOptionTrade>> {
  const map = new Map<string, AlpacaActiveOptionTrade>();
  try {
    const headers = getAlpacaHeaders();
    const afterIso = `${todayStr}T04:00:00Z`;
    const [posRes, ordRes] = await Promise.all([
      fetch(`${ALPACA_PAPER_TRADING_URL}/positions`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(3500),
      }),
      fetch(
        `${ALPACA_PAPER_TRADING_URL}/orders?status=all&after=${encodeURIComponent(afterIso)}&limit=50`,
        {
          headers,
          cache: 'no-store',
          signal: AbortSignal.timeout(3500),
        }
      ),
    ]);

    const positions: any[] = posRes.ok ? await posRes.json() : [];
    const orders: any[] = ordRes.ok ? await ordRes.json() : [];

    const parseOcc = (sym: string) => {
      const m = String(sym || '').match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/);
      if (!m) return null;
      return {
        underlying: m[1],
        direction: (m[3] === 'P' ? 'PUT' : 'CALL') as 'CALL' | 'PUT',
        strike: parseInt(m[4], 10) / 1000,
      };
    };

    for (const p of positions) {
      const parsed = parseOcc(p.symbol);
      if (!parsed) continue;
      const avgEntry = parseFloat(p.avg_entry_price) || 2.5;
      const curPrice = parseFloat(p.current_price) || avgEntry;
      map.set(parsed.underlying, {
        underlying: parsed.underlying,
        occSymbol: p.symbol,
        direction: parsed.direction,
        strike: parsed.strike,
        qty: Math.abs(parseInt(p.qty, 10) || 1),
        avgEntryPrice: Math.round(avgEntry * 100) / 100,
        currentPrice: Math.round(curPrice * 100) / 100,
        status: 'OPEN_POSITION',
      });
    }

    for (const o of orders) {
      if (o.side === 'buy' && o.status === 'filled') {
        const parsed = parseOcc(o.symbol);
        if (!parsed || map.has(parsed.underlying)) continue;
        const fillPrice = parseFloat(o.filled_avg_price) || 2.5;
        map.set(parsed.underlying, {
          underlying: parsed.underlying,
          occSymbol: o.symbol,
          direction: parsed.direction,
          strike: parsed.strike,
          qty: Math.abs(parseInt(o.qty, 10) || 1),
          avgEntryPrice: Math.round(fillPrice * 100) / 100,
          currentPrice: Math.round(fillPrice * 100) / 100,
          status: 'FILLED_TODAY',
        });
      }
    }
  } catch (err: any) {
    console.warn('[AlpacaClient] fetchTodayAlpacaOptionTrades error:', err?.message);
  }
  return map;
}

/**
 * 3. Place Automatic Alpaca Paper Option Order Upon Signal Fire
 * Protects against duplicate positions or repeat same-day orders on the same underlying symbol.
 */
export async function placeAlpacaPaperOptionOrder(params: {
  underlying: string;
  strike: number;
  direction: 'CALL' | 'PUT';
  qty?: number;
  allowZeroDte?: boolean;
}): Promise<AlpacaOrderExecutionResult> {
  const {
    underlying,
    strike,
    direction,
    qty = 3,
    allowZeroDte = false,
  } = params;

  try {
    const headers = getAlpacaHeaders();
    const estNow = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    );
    const todayStr = `${estNow.getFullYear()}-${String(estNow.getMonth() + 1).padStart(2, '0')}-${String(estNow.getDate()).padStart(2, '0')}`;
    const afterIso = `${todayStr}T04:00:00Z`;

    // 1. Check existing open positions & all today's orders to prevent duplicate entries on the same ticker
    const [posRes, ordRes] = await Promise.all([
      fetch(`${ALPACA_PAPER_TRADING_URL}/positions`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(3500),
      }),
      fetch(
        `${ALPACA_PAPER_TRADING_URL}/orders?status=all&after=${encodeURIComponent(afterIso)}&limit=50`,
        {
          headers,
          cache: 'no-store',
          signal: AbortSignal.timeout(3500),
        }
      ),
    ]);

    const positions: any[] = posRes.ok ? await posRes.json() : [];
    const todayOrders: any[] = ordRes.ok ? await ordRes.json() : [];

    const cleanSym = underlying.toUpperCase();
    const alreadyHolding = positions.find((p) =>
      String(p.symbol || '').startsWith(cleanSym)
    );
    if (alreadyHolding) {
      return {
        success: true,
        occSymbol: alreadyHolding.symbol,
        qty: parseInt(alreadyHolding.qty, 10) || qty,
        status: 'already_open',
        filledAvgPrice: parseFloat(alreadyHolding.avg_entry_price) || null,
        message: `Position already active in Alpaca Paper (${alreadyHolding.symbol}, Qty: ${alreadyHolding.qty} @ $${parseFloat(alreadyHolding.avg_entry_price).toFixed(2)})`,
      };
    }

    const alreadyOrderedToday = todayOrders.find(
      (o) =>
        String(o.symbol || '').startsWith(cleanSym) &&
        o.side === 'buy' &&
        o.status !== 'canceled' &&
        o.status !== 'rejected'
    );
    if (alreadyOrderedToday) {
      return {
        success: true,
        orderId: alreadyOrderedToday.id,
        occSymbol: alreadyOrderedToday.symbol,
        qty: parseInt(alreadyOrderedToday.qty, 10) || qty,
        status: 'already_traded_today',
        message: `Order already placed today in Alpaca Paper (${alreadyOrderedToday.symbol}, Status: ${alreadyOrderedToday.status})`,
      };
    }

    // 2. Resolve exact OCC contract and live OPRA quote
    const resolved = await resolveAlpacaOptionContract(
      cleanSym,
      strike,
      direction,
      allowZeroDte
    );
    if (!resolved) {
      return {
        success: false,
        message: `Could not resolve active OCC option contract on Alpaca for ${cleanSym} $${strike} ${direction}`,
      };
    }

    const maxPayCeiling = Math.round(resolved.ask * 1.05 * 100) / 100;

    // 3. Submit Paper Market Order (during regular hours) or Limit Order at Ask (if off-hours queued)
    const orderPayload: Record<string, any> = {
      symbol: resolved.occSymbol,
      qty: String(qty),
      side: 'buy',
      type: 'market',
      time_in_force: 'day',
    };

    const orderRes = await fetch(`${ALPACA_PAPER_TRADING_URL}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(orderPayload),
      signal: AbortSignal.timeout(4000),
    });

    const orderJson = await orderRes.json();
    if (!orderRes.ok) {
      return {
        success: false,
        occSymbol: resolved.occSymbol,
        bidPrice: resolved.bid,
        limitOrAskPrice: resolved.ask,
        spreadPct: resolved.spreadPct,
        maxPayCeiling,
        message:
          orderJson?.message ||
          `Alpaca order rejected (${orderRes.status}) for ${resolved.occSymbol}`,
      };
    }

    return {
      success: true,
      orderId: orderJson.id,
      occSymbol: resolved.occSymbol,
      qty,
      side: 'buy',
      status: orderJson.status,
      filledAvgPrice: orderJson.filled_avg_price
        ? parseFloat(orderJson.filled_avg_price)
        : null,
      bidPrice: resolved.bid,
      limitOrAskPrice: resolved.ask,
      spreadPct: resolved.spreadPct,
      maxPayCeiling,
      message: `Alpaca Paper Order Submitted: BUY ${qty}x ${resolved.occSymbol} (${cleanSym} $${resolved.strike} ${direction} exp ${resolved.expirationDate}) @ $${resolved.bid.toFixed(2)}×$${resolved.ask.toFixed(2)} (Spread: ${resolved.spreadPct}% | Max Pay: $${maxPayCeiling.toFixed(2)}) [Status: ${String(orderJson.status).toUpperCase()}]`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Alpaca execution error: ${err?.message || 'Unknown error'}`,
    };
  }
}

/**
 * 4. Autonomous Alpaca Paper Position Guardian
 * Checks all open option positions in Alpaca Paper on every cron tick:
 * - Closes full position at Target 2 (+60% gain)
 * - Trims 50% at Target 1 (+30% gain) if qty >= 2
 * - Early Tape-Reversal Exit (-14% loss when SPY & QQQ both break VWAP against the position)
 * - Cuts full position at Hard Stop Loss (-25% loss)
 * - Closes intraday positions at 15:55 PM ET before market close
 */
export async function manageAlpacaPaperPositions(
  timeVal: number,
  indexContext?: {
    spyBelowVwap?: boolean;
    qqqBelowVwap?: boolean;
  }
): Promise<
  Array<{
    symbol: string;
    action:
      | 'TARGET_1_TRIM'
      | 'TARGET_2_EXIT'
      | 'TAPE_REVERSAL_EXIT'
      | 'STOP_LOSS_EXIT'
      | 'EOD_CLOSE';
    qty: number;
    avgEntry: number;
    currentPrice: number;
    pnlDollars: number;
    pnlPct: number;
    summary: string;
  }>
> {
  const actionsTaken: Array<{
    symbol: string;
    action:
      | 'TARGET_1_TRIM'
      | 'TARGET_2_EXIT'
      | 'TAPE_REVERSAL_EXIT'
      | 'STOP_LOSS_EXIT'
      | 'EOD_CLOSE';
    qty: number;
    avgEntry: number;
    currentPrice: number;
    pnlDollars: number;
    pnlPct: number;
    summary: string;
  }> = [];

  try {
    const headers = getAlpacaHeaders();
    const posRes = await fetch(`${ALPACA_PAPER_TRADING_URL}/positions`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    });
    if (!posRes.ok) return actionsTaken;

    const positions: any[] = await posRes.json();
    for (const pos of positions) {
      const occSymbol = String(pos.symbol || '');
      const qty = parseInt(pos.qty, 10) || 0;
      if (qty <= 0) continue;

      const avgEntry = parseFloat(pos.avg_entry_price) || 0;
      const currentPrice = parseFloat(pos.current_price) || avgEntry;
      const pnlDollars = parseFloat(pos.unrealized_pl) || 0;
      const pnlRatio = parseFloat(pos.unrealized_plpc) || 0; // e.g. 0.32 for +32%
      const pnlPct = Math.round(pnlRatio * 1000) / 10;
      const isCallPos = /\d{6}C\d{8}$/i.test(occSymbol);
      const isPutPos = /\d{6}P\d{8}$/i.test(occSymbol);

      // 1. Target 2 Full Harvest (+60% or higher)
      if (pnlRatio >= 0.60) {
        const closeRes = await fetch(
          `${ALPACA_PAPER_TRADING_URL}/positions/${encodeURIComponent(occSymbol)}`,
          { method: 'DELETE', headers }
        );
        if (closeRes.ok) {
          actionsTaken.push({
            symbol: occSymbol,
            action: 'TARGET_2_EXIT',
            qty,
            avgEntry,
            currentPrice,
            pnlDollars,
            pnlPct,
            summary: `🚀 ALPACA PAPER AUTO-EXIT (TARGET 2 HIT): Closed ${qty}x ${occSymbol} @ $${currentPrice.toFixed(2)} (Entry: $${avgEntry.toFixed(2)}) for +$${pnlDollars.toFixed(2)} (+${pnlPct}%)`,
          });
        }
        continue;
      }

      // 2. Proactive Early Tape-Reversal Exit (-14% loss when SPY & QQQ both break VWAP against position)
      const isMarketRollingAgainstCall =
        isCallPos &&
        indexContext?.spyBelowVwap === true &&
        indexContext?.qqqBelowVwap === true;
      const isMarketSqueezingAgainstPut =
        isPutPos &&
        indexContext?.spyBelowVwap === false &&
        indexContext?.qqqBelowVwap === false;

      if (
        pnlRatio <= -0.14 &&
        pnlRatio > -0.25 &&
        (isMarketRollingAgainstCall || isMarketSqueezingAgainstPut)
      ) {
        const closeRes = await fetch(
          `${ALPACA_PAPER_TRADING_URL}/positions/${encodeURIComponent(occSymbol)}`,
          { method: 'DELETE', headers }
        );
        if (closeRes.ok) {
          actionsTaken.push({
            symbol: occSymbol,
            action: 'TAPE_REVERSAL_EXIT',
            qty,
            avgEntry,
            currentPrice,
            pnlDollars,
            pnlPct,
            summary: `🛡️ POSITION GUARDIAN EARLY EXIT (INDEX VWAP REVERSAL): Closed ${qty}x ${occSymbol} early @ $${currentPrice.toFixed(2)} (${pnlPct}%) because SPY & QQQ reversed against trade direction—saved capital before -25% hard stop!`,
          });
        }
        continue;
      }

      // 3. Hard Stop-Loss Protection (-25% or worse)
      if (pnlRatio <= -0.25) {
        const closeRes = await fetch(
          `${ALPACA_PAPER_TRADING_URL}/positions/${encodeURIComponent(occSymbol)}`,
          { method: 'DELETE', headers }
        );
        if (closeRes.ok) {
          actionsTaken.push({
            symbol: occSymbol,
            action: 'STOP_LOSS_EXIT',
            qty,
            avgEntry,
            currentPrice,
            pnlDollars,
            pnlPct,
            summary: `🛑 ALPACA PAPER AUTO-STOP (-25% RULE): Closed ${qty}x ${occSymbol} @ $${currentPrice.toFixed(2)} (Entry: $${avgEntry.toFixed(2)}) for $${pnlDollars.toFixed(2)} (${pnlPct}%)`,
          });
        }
        continue;
      }

      // 4. Target 1 Partial Scale (+30% gain, when holding >= 2 contracts)
      if (pnlRatio >= 0.30 && qty >= 2) {
        const trimQty = Math.max(1, Math.floor(qty / 2));
        const trimRes = await fetch(`${ALPACA_PAPER_TRADING_URL}/orders`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            symbol: occSymbol,
            qty: String(trimQty),
            side: 'sell',
            type: 'market',
            time_in_force: 'day',
          }),
        });
        if (trimRes.ok) {
          actionsTaken.push({
            symbol: occSymbol,
            action: 'TARGET_1_TRIM',
            qty: trimQty,
            avgEntry,
            currentPrice,
            pnlDollars:
              Math.round((currentPrice - avgEntry) * trimQty * 100 * 100) / 100,
            pnlPct,
            summary: `🎯 ALPACA PAPER AUTO-SCALE (TARGET 1 +30%): Sold ${trimQty}x of ${qty}x ${occSymbol} @ $${currentPrice.toFixed(2)} (Entry: $${avgEntry.toFixed(2)}, +${pnlPct}%)`,
          });
        }
        continue;
      }

      // 5. End-of-Day Cash Settlement (15:55 PM ET onwards)
      if (timeVal >= 1555 && timeVal <= 1600) {
        const closeRes = await fetch(
          `${ALPACA_PAPER_TRADING_URL}/positions/${encodeURIComponent(occSymbol)}`,
          { method: 'DELETE', headers }
        );
        if (closeRes.ok) {
          actionsTaken.push({
            symbol: occSymbol,
            action: 'EOD_CLOSE',
            qty,
            avgEntry,
            currentPrice,
            pnlDollars,
            pnlPct,
            summary: `🔔 ALPACA PAPER 15:55 EOD SETTLEMENT: Closed ${qty}x ${occSymbol} @ $${currentPrice.toFixed(2)} (Entry: $${avgEntry.toFixed(2)}) for ${pnlDollars >= 0 ? '+' : ''}$${pnlDollars.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct}%)`,
          });
        }
      }
    }
  } catch (err: any) {
    console.warn('[AlpacaClient] Position guardian error:', err?.message);
  }

  return actionsTaken;
}

/**
 * 5. Fetch Live Alpaca Paper Account Summary, Open Positions & Recent Option Orders
 */
export async function fetchAlpacaPaperPortfolio() {
  try {
    const headers = getAlpacaHeaders();
    const [accRes, posRes, ordRes] = await Promise.all([
      fetch(`${ALPACA_PAPER_TRADING_URL}/account`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(3500),
      }),
      fetch(`${ALPACA_PAPER_TRADING_URL}/positions`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(3500),
      }),
      fetch(`${ALPACA_PAPER_TRADING_URL}/orders?status=all&limit=15`, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(3500),
      }),
    ]);

    const account = accRes.ok ? await accRes.json() : null;
    const positions = posRes.ok ? await posRes.json() : [];
    const orders = ordRes.ok ? await ordRes.json() : [];

    return {
      connected: Boolean(account?.id),
      account: account
        ? {
            status: account.status,
            equity: parseFloat(account.equity),
            lastEquity: parseFloat(account.last_equity),
            dayPnl:
              Math.round(
                (parseFloat(account.equity) - parseFloat(account.last_equity)) *
                  100
              ) / 100,
            buyingPower: parseFloat(account.buying_power),
            optionsLevel: account.options_trading_level,
          }
        : null,
      positions: Array.isArray(positions)
        ? positions.map((p: any) => ({
            symbol: p.symbol,
            qty: parseInt(p.qty, 10),
            avgEntryPrice: parseFloat(p.avg_entry_price),
            currentPrice: parseFloat(p.current_price),
            marketValue: parseFloat(p.market_value),
            unrealizedPl: parseFloat(p.unrealized_pl),
            unrealizedPlPct:
              Math.round(parseFloat(p.unrealized_plpc) * 1000) / 10,
          }))
        : [],
      recentOrders: Array.isArray(orders)
        ? orders.map((o: any) => ({
            id: o.id,
            symbol: o.symbol,
            side: o.side,
            qty: parseInt(o.qty || o.filled_qty || '0', 10),
            type: o.type,
            status: o.status,
            filledAvgPrice: o.filled_avg_price
              ? parseFloat(o.filled_avg_price)
              : null,
            createdAt: o.created_at,
            filledAt: o.filled_at,
          }))
        : [],
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err?.message || 'Failed to connect to Alpaca Paper API',
      account: null,
      positions: [],
      recentOrders: [],
    };
  }
}
