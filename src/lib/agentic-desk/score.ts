export interface Pillars {
    trend: { score: number; detail: string };
    momentum: { score: number; detail: string };
    macro_sentiment: { score: number | null; detail: string };
}

export interface Flags {
    exhaustion: string[];
    bearish: string[];
    rebound: string[];
    death_cross: boolean;
    stretch_pct: number;
}

export interface Decision {
    action: string;
    rationale: string;
    framing: string;
    flags: Flags;
}

export interface Indicators {
    n_bars: number;
    warning: string | null;
    close: number;
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
    ema20_slope: number | null;
    ema50_slope: number | null;
    ema200_slope: number | null;
    rsi14: number | null;
    rsi14_prev: number | null;
    macd_line: number | null;
    macd_signal: number | null;
    macd_hist: number | null;
    macd_hist_prev: number | null;
    trix: number | null;
    trix_prev: number | null;
    trix_signal: number | null;
    trix_signal_prev: number | null;
    bars_since_below_ema20: number | null;
    bb_mid: number | null;
    bb_upper: number | null;
    bb_lower: number | null;
    percent_b: number | null;
}

export interface ScoreSymbolResult {
    symbol: string | null;
    n_bars: number;
    warning: string | null;
    pillars: Pillars;
    pillar_total: number;
    decision: Decision;
    indicators: Indicators;
}

function pstdev(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
}

function emaSeries(values: number[], period: number): (number | null)[] {
    const n = values.length;
    const out: (number | null)[] = Array(n).fill(null);
    if (n < period) return out;
    const k = 2.0 / (period + 1);
    let seed = 0;
    for (let i = 0; i < period; i++) {
        seed += values[i];
    }
    seed /= period;
    out[period - 1] = seed;
    let prev = seed;
    for (let i = period; i < n; i++) {
        prev = values[i] * k + prev * (1 - k);
        out[i] = prev;
    }
    return out;
}

function strip(values: (number | null)[]): number[] {
    return values.filter(v => v !== null) as number[];
}

function rsiWilder(close: number[], period: number = 14): (number | null)[] {
    const n = close.length;
    const out: (number | null)[] = Array(n).fill(null);
    if (n < period + 1) return out;
    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = 1; i < n; i++) {
        const ch = close[i] - close[i - 1];
        gains.push(Math.max(ch, 0.0));
        losses.push(Math.max(-ch, 0.0));
    }
    
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
        avgGain += gains[i];
        avgLoss += losses[i];
    }
    avgGain /= period;
    avgLoss /= period;

    const rsiVal = (ag: number, al: number): number => {
        if (al === 0) return 100.0;
        const rs = ag / al;
        return 100.0 - 100.0 / (1.0 + rs);
    };

    out[period] = rsiVal(avgGain, avgLoss);
    for (let i = period + 1; i < n; i++) {
        const g = gains[i - 1];
        const l = losses[i - 1];
        avgGain = (avgGain * (period - 1) + g) / period;
        avgLoss = (avgLoss * (period - 1) + l) / period;
        out[i] = rsiVal(avgGain, avgLoss);
    }
    return out;
}

function macd(close: number[], fast: number = 12, slow: number = 26, signal: number = 9) {
    const ef = emaSeries(close, fast);
    const es = emaSeries(close, slow);
    const line: (number | null)[] = ef.map((a, i) => {
        const b = es[i];
        return (a !== null && b !== null) ? a - b : null;
    });
    const valid = strip(line);
    const sigValid = emaSeries(valid, signal);
    const sig: (number | null)[] = Array(close.length).fill(null);
    const first = line.findIndex(v => v !== null);
    if (first !== -1) {
        for (let off = 0; off < sigValid.length; off++) {
            sig[first + off] = sigValid[off];
        }
    }
    const hist: (number | null)[] = line.map((m, i) => {
        const s = sig[i];
        return (m !== null && s !== null) ? m - s : null;
    });
    return { line, sig, hist };
}

function trix(close: number[], period: number = 15, signal: number = 9) {
    const n = close.length;
    const e1 = strip(emaSeries(close, period));
    const e2 = strip(emaSeries(e1, period));
    const e3 = strip(emaSeries(e2, period));
    const trixValid: number[] = [];
    for (let i = 1; i < e3.length; i++) {
        const prev = e3[i - 1];
        trixValid.push(prev !== 0 ? ((e3[i] - prev) / prev) * 100.0 : 0.0);
    }
    const sigValid = strip(emaSeries(trixValid, signal));
    
    const t: (number | null)[] = Array(n).fill(null);
    for (let off = 0; off < trixValid.length; off++) {
        const idx = n - trixValid.length + off;
        if (idx >= 0) t[idx] = trixValid[off];
    }
    const s: (number | null)[] = Array(n).fill(null);
    for (let off = 0; off < sigValid.length; off++) {
        const idx = n - sigValid.length + off;
        if (idx >= 0) s[idx] = sigValid[off];
    }
    return { t, s };
}

function bollinger(close: number[], period: number = 20, mult: number = 2.0) {
    if (close.length < period) return { mid: null, upper: null, lower: null, pct_b: null };
    const window = close.slice(close.length - period);
    const mid = window.reduce((a, b) => a + b, 0) / period;
    const sd = pstdev(window);
    const upper = mid + mult * sd;
    const lower = mid - mult * sd;
    const rng = upper - lower;
    const pct_b = rng !== 0 ? (close[close.length - 1] - lower) / rng : 0.5;
    return { mid, upper, lower, pct_b };
}

function getSlope(series: (number | null)[], lookback: number): number | null {
    const validIdx = series.map((v, i) => (v !== null ? i : -1)).filter(i => i !== -1);
    if (validIdx.length <= lookback) return null;
    const lastI = validIdx[validIdx.length - 1];
    const prevI = validIdx[validIdx.length - 1 - lookback];
    return (series[lastI] as number) - (series[prevI] as number);
}

function computeIndicators(close: number[], slopeLookback: number = 5): Indicators {
    let warn: string | null = null;
    if (close.length < 210) {
        warn = `Only ${close.length} bars; EMA200/some indicators may be None. Ideal >=220.`;
    }

    const ema20 = emaSeries(close, 20);
    const ema50 = emaSeries(close, 50);
    const ema200 = emaSeries(close, 200);
    const rsi = rsiWilder(close, 14);
    const { line: macdLine, sig: macdSig, hist: macdHist } = macd(close, 12, 26, 9);
    const { t: trixLine, s: trixSig } = trix(close, 15, 9);
    const { mid: bbMid, upper: bbUp, lower: bbLo, pct_b: pctB } = bollinger(close, 20, 2.0);

    const last = (s: (number | null)[]) => {
        const v = strip(s);
        return v.length > 0 ? v[v.length - 1] : null;
    };
    const prev = (s: (number | null)[]) => {
        const v = strip(s);
        return v.length >= 2 ? v[v.length - 2] : null;
    };

    let barsSinceBelowEma20: number | null = null;
    for (let back = 0; back < close.length; back++) {
        const i = close.length - 1 - back;
        if (ema20[i] !== null && close[i] < (ema20[i] as number)) {
            barsSinceBelowEma20 = back;
            break;
        }
    }

    return {
        n_bars: close.length,
        warning: warn,
        close: close[close.length - 1],
        ema20: last(ema20),
        ema50: last(ema50),
        ema200: last(ema200),
        ema20_slope: getSlope(ema20, slopeLookback),
        ema50_slope: getSlope(ema50, slopeLookback),
        ema200_slope: getSlope(ema200, slopeLookback),
        rsi14: last(rsi),
        rsi14_prev: prev(rsi),
        macd_line: last(macdLine),
        macd_signal: last(macdSig),
        macd_hist: last(macdHist),
        macd_hist_prev: prev(macdHist),
        trix: last(trixLine),
        trix_prev: prev(trixLine),
        trix_signal: last(trixSig),
        trix_signal_prev: prev(trixSig),
        bars_since_below_ema20: barsSinceBelowEma20,
        bb_mid: bbMid,
        bb_upper: bbUp,
        bb_lower: bbLo,
        percent_b: pctB,
    };
}

function roundIndicators(ind: Indicators, nd: number = 4): Indicators {
    const res: any = {};
    for (const [k, v] of Object.entries(ind)) {
        if (typeof v === 'number' && k !== 'n_bars' && k !== 'bars_since_below_ema20') {
            const factor = Math.pow(10, nd);
            res[k] = Math.round(v * factor) / factor;
        } else {
            res[k] = v;
        }
    }
    return res as Indicators;
}

function scoreTrend(ind: Indicators): { score: number; detail: string } {
    const c = ind.close;
    const e20 = ind.ema20;
    const e50 = ind.ema50;
    const e200 = ind.ema200;
    const s200 = ind.ema200_slope;
    
    let pts = 0;
    const bits: string[] = [];
    
    if (e20 !== null) {
        if (c > e20) { pts += 1; bits.push("price>EMA20"); }
        else { pts -= 1; bits.push("price<EMA20"); }
    }
    if (e20 !== null && e50 !== null) {
        if (e20 > e50) { pts += 1; bits.push("EMA20>EMA50"); }
        else { pts -= 1; bits.push("EMA20<EMA50"); }
    }
    if (e50 !== null && e200 !== null) {
        if (e50 > e200) { pts += 1; bits.push("EMA50>EMA200"); }
        else { pts -= 1; bits.push("EMA50<EMA200"); }
    }
    if (s200 !== null) {
        if (s200 > 0) { pts += 1; bits.push("EMA200↑"); }
        else { pts -= 1; bits.push("EMA200↓"); }
    }
    
    const score = pts >= 3 ? 2 : pts >= 1 ? 1 : pts === 0 ? 0 : pts >= -2 ? -1 : -2;
    return { score, detail: bits.join(", ") };
}

function scoreMomentum(ind: Indicators): { score: number; detail: string } {
    const rsi = ind.rsi14;
    const hist = ind.macd_hist;
    const trix = ind.trix;
    const trixSig = ind.trix_signal;
    
    let pts = 0;
    const bits: string[] = [];
    
    if (rsi !== null) {
        if (rsi >= 55) { pts += 1; bits.push(`RSI ${Math.round(rsi)}≥55`); }
        else if (rsi <= 45) { pts -= 1; bits.push(`RSI ${Math.round(rsi)}≤45`); }
        else { bits.push(`RSI ${Math.round(rsi)} neutral`); }
    }
    if (hist !== null) {
        if (hist > 0) { pts += 1; bits.push("MACD hist>0"); }
        else { pts -= 1; bits.push("MACD hist<0"); }
    }
    if (trix !== null && trixSig !== null) {
        if (trix > trixSig && trix > 0) { pts += 1; bits.push("TRIX>signal>0"); }
        else if (trix < trixSig && trix < 0) { pts -= 1; bits.push("TRIX<signal<0"); }
        else { bits.push("TRIX mixed"); }
    }
    
    const score = pts >= 2 ? 2 : pts === 1 ? 1 : pts === 0 ? 0 : pts === -1 ? -1 : -2;
    return { score, detail: bits.join(", ") };
}

function getFlags(ind: Indicators): Flags {
    const c = ind.close;
    const e20 = ind.ema20;
    const e50 = ind.ema50;
    const e200 = ind.ema200;
    const s200 = ind.ema200_slope;
    const rsi = ind.rsi14;
    const rsi_p = ind.rsi14_prev;
    const hist = ind.macd_hist;
    const hist_p = ind.macd_hist_prev;
    const trix = ind.trix;
    const trix_sig = ind.trix_signal;
    const pb = ind.percent_b;
    const stretch = e20 !== null ? (c / e20 - 1.0) : 0.0;

    const exhaustion: string[] = [];
    const bearish: string[] = [];
    const rebound: string[] = [];

    // Bullish exhaustion
    if (rsi !== null && rsi_p !== null && rsi >= 70 && rsi < rsi_p) {
        exhaustion.push(`RSI turning from overbought (${Math.round(rsi_p)}→${Math.round(rsi)})`);
    }
    if (hist !== null && hist_p !== null && hist > 0 && hist < hist_p) {
        exhaustion.push("MACD histogram shrinking in positive territory");
    }
    if (pb !== null && pb >= 1.0) {
        exhaustion.push("price at/above upper Bollinger Band (%B≥1)");
    }
    if (stretch >= 0.10) {
        exhaustion.push(`price stretched ${Math.round(stretch * 100)}% above EMA20`);
    }

    // Relentless bearish
    if (e50 !== null && e200 !== null && s200 !== null && c < e50 && e50 < e200 && s200 < 0) {
        bearish.push("price<EMA50<EMA200 with EMA200↓");
    }
    if (hist !== null && hist_p !== null && hist < 0 && hist < hist_p) {
        bearish.push("MACD histogram deepening in negative territory");
    }
    if (trix !== null && trix_sig !== null && trix < trix_sig && trix < 0) {
        bearish.push("TRIX<signal below zero");
    }
    if (rsi !== null && rsi_p !== null && rsi < 45 && rsi < rsi_p) {
        bearish.push(`RSI weak and falling (${Math.round(rsi)})`);
    }

    // Rebound / reversal
    if (rsi !== null && rsi_p !== null && rsi_p < 35 && rsi > rsi_p) {
        rebound.push(`RSI turning from oversold (${Math.round(rsi_p)}→${Math.round(rsi)})`);
    }
    if (hist !== null && hist_p !== null && hist > hist_p && hist_p < 0) {
        rebound.push("MACD histogram crossing bullishly");
    }
    
    const bsb = ind.bars_since_below_ema20;
    if (e20 !== null && c > e20 && ind.ema20_slope !== null && ind.ema20_slope > 0 && bsb !== null && bsb >= 1 && bsb <= 5) {
        rebound.push(`price reclaims EMA20 (closed below ${bsb} bar${bsb > 1 ? 's' : ''} ago)`);
    }

    const trix_p = ind.trix_prev;
    const sig_p = ind.trix_signal_prev;
    if (trix !== null && trix_sig !== null && trix_p !== null && sig_p !== null &&
        trix > trix_sig && trix_p <= sig_p && trix <= 0) {
        rebound.push("fresh bullish TRIX cross below zero");
    }

    const death_cross = Boolean(e50 !== null && e200 !== null && e50 < e200 && c < e50);

    return {
        exhaustion,
        bearish,
        rebound,
        death_cross,
        stretch_pct: Math.round(stretch * 1000) / 10
    };
}

function decide(ind: Indicators, trend: number, mom: number, macro: number | null | undefined, holding: boolean | null | undefined): Decision {
    const f = getFlags(ind);
    const n_exh = f.exhaustion.length;
    const n_bear = f.bearish.length;
    const n_reb = f.rebound.length;
    const dc = f.death_cross;
    const in_pos = holding === true;

    let action = "";
    let rationale = "";
    let framing = "";

    if (in_pos && n_exh >= 2) {
        action = "EXIT / TRIM";
        rationale = "Bullish momentum EXHAUSTED.";
        framing = "Partial or full exit: buying momentum is dying out. Rotate capital and flag for re-entry on the next rebound.";
    } else if (in_pos && (n_bear >= 3 || (dc && n_bear >= 2))) {
        action = "EXIT";
        rationale = "Bearish momentum RELENTLESS.";
        framing = "Exit: selling pressure is sustained. Do not average down.";
        if (n_reb >= 2) {
            framing += " Rebound in progress: use it to exit at a better price, not to justify holding.";
        }
    } else if (!in_pos && n_reb >= 2 && !dc) {
        action = "RE-ENTRY (new cycle)";
        rationale = "Rebound/reversal with healthy EMA structure: likely start of a new bullish cycle.";
        framing = "Valid entry trigger. Confirm with candle/volume before entering full size; stop below the rebound pivot.";
    } else if (!in_pos && n_reb >= 2 && dc) {
        action = "TACTICAL REBOUND (counter-trend)";
        rationale = "Rebound signals within a death-cross: tactical trade, NOT a new cycle.";
        framing = "Short-term opportunity against the structure: reduced size, close target (EMA20/EMA50 or middle band), tight stop, and quick exit. Do not let it turn into a hold — the underlying trend remains bearish.";
        if (n_bear >= 2) {
            framing += " Bearish flags still active: extra tight leash.";
        }
    } else if (!in_pos && (n_bear >= 3 || (dc && n_bear >= 2))) {
        action = "STAY OUT / AVOID";
        rationale = "Bearish momentum RELENTLESS, no fresh rebound trigger.";
        framing = "Out. Watch for capitulation: the trigger would be a fresh RSI/MACD turn.";
    } else if (trend >= 1 && mom >= 1) {
        if (in_pos) {
            action = "HOLD (ride the cycle)";
            rationale = "Bullish cycle intact (Trend and Momentum positive).";
            framing = "Hold and watch for exhaustion: the next expected action is EXIT with profit, not adding to position. Accumulating is not the default (capital rotation > large position).";
        } else {
            action = "WAIT (do not chase)";
            rationale = "Healthy trend but no fresh entry trigger.";
            framing = "Entering mid-trend is chasing: poor R/R for the short term. Wait for pullback to EMA20 and turn, or the next confirmed rebound.";
        }
    } else if (trend <= -1 && mom <= -1) {
        if (in_pos) {
            action = "HOLD (under review)";
            rationale = "Weak structure and momentum, but no full exit trigger.";
            framing = "Do not add. Prepare to exit: if more bearish flags appear or the current rebound fizzles out, execute EXIT. If a rebound is active, it can be used to exit at a better price.";
        } else {
            action = "STAY OUT / AVOID";
            rationale = "Negative structure and momentum, no signs of turning.";
            framing = "Out. The next trigger here would be a confirmed rebound (tactical trade).";
        }
    } else {
        action = in_pos ? "HOLD / OBSERVE" : "OBSERVE";
        rationale = "Mixed signals; no clear exhaustion or rebound trigger.";
        framing = "No action. Watch the next close.";
    }

    if (macro !== null && macro !== undefined && macro <= -1) {
        if (action === "HOLD (ride the cycle)") {
            framing += " ⚠ Adverse macro: lower the exit threshold (take profit earlier).";
        } else if (action === "TACTICAL REBOUND (counter-trend)") {
            framing += " ⚠ Adverse macro: reduce size further or skip this rebound.";
        } else if (action === "RE-ENTRY (new cycle)") {
            framing += " ⚠ Adverse macro: entry in reduced size.";
        }
    }

    if (in_pos && n_reb >= 2 && action.startsWith("HOLD")) {
        framing += " (Rebound signals in progress reinforce holding.)";
    }
    if (holding === false && (action === "EXIT / TRIM" || action === "EXIT")) {
        framing += " (You are flat: the exit signal only confirms not entering long.)";
    }

    return { action, rationale, framing, flags: f };
}

export function scoreSymbol(close: number[], symbol: string, macro_score?: number, holding?: boolean, slope_lookback: number = 5): ScoreSymbolResult {
    const ind = computeIndicators(close, slope_lookback);
    const { score: t, detail: t_detail } = scoreTrend(ind);
    const { score: m, detail: m_detail } = scoreMomentum(ind);
    const dec = decide(ind, t, m, macro_score, holding);
    const composite = t + m + (macro_score ?? 0);
    
    return {
        symbol: symbol ?? null,
        n_bars: ind.n_bars,
        warning: ind.warning,
        pillars: {
            trend: { score: t, detail: t_detail },
            momentum: { score: m, detail: m_detail },
            macro_sentiment: { score: macro_score ?? null, detail: "injected from macro_pillar.py" },
        },
        pillar_total: composite,
        decision: dec,
        indicators: roundIndicators(ind),
    };
}
