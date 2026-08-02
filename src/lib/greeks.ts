/**
 * Black-Scholes Options Pricing & Greeks Engine
 * Implementation based on standard quantitative finance formulas.
 */

// Cumulative Standard Normal Distribution
function cnd(x: number): number {
    const a1 = 0.31938153;
    const a2 = -0.356563782;
    const a3 = 1.781477937;
    const a4 = -1.821255978;
    const a5 = 1.330274429;
    const L = Math.abs(x);
    const K = 1.0 / (1.0 + 0.2316419 * L);
    let d = 1.0 - 1.0 / Math.sqrt(2 * Math.PI) * Math.exp(-L * L / 2) * (a1 * K + a2 * K * K + a3 * Math.pow(K, 3) + a4 * Math.pow(K, 4) + a5 * Math.pow(K, 5));

    if (x < 0) d = 1.0 - d;
    return d;
}

// Probability Density Function of Standard Normal Distribution
function nd(x: number): number {
    return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

/**
 * Calculates Greeks for a given option state
 * @param S Current Stock Price
 * @param K Strike Price
 * @param T Time to Expiration (Years)
 * @param r Risk-Free Rate (e.g., 0.05 for 5%)
 * @param v Volatility (e.g., 0.25 for 25% IV)
 * @param type "Call" | "Put"
 */
export function calculateGreeks(
    S: number,
    K: number,
    T: number,
    r: number,
    v: number,
    type: "Call" | "Put"
) {
    // Prevent division by zero or negative time
    if (T <= 0) return { delta: 0, gamma: 0, theta: 0, vega: 0, iv: v };

    const d1 = (Math.log(S / K) + (r + (v * v) / 2) * T) / (v * Math.sqrt(T));
    const d2 = d1 - v * Math.sqrt(T);

    let delta = 0;
    let theta = 0;

    if (type === "Call") {
        delta = cnd(d1);
        theta = (- (S * nd(d1) * v) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * cnd(d2)) / 365;
    } else {
        delta = cnd(d1) - 1;
        theta = (- (S * nd(d1) * v) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * cnd(-d2)) / 365;
    }

    const gamma = nd(d1) / (S * v * Math.sqrt(T));
    const vega = (S * Math.sqrt(T) * nd(d1)) / 100; // Divide by 100 for 1% vol move

    return {
        delta: parseFloat(delta.toFixed(4)),
        gamma: parseFloat(gamma.toFixed(4)),
        theta: parseFloat(theta.toFixed(4)),
        vega: parseFloat(vega.toFixed(4)),
        iv: v
    };
}

/**
 * Calculates Probability of Profit (POP) using Black-Scholes d2
 * POP is defined as the probability of the option expiring in-the-money (or out-of-the-money for sellers)
 */
export function calculatePOP(
    S: number,
    K: number,
    T: number,
    r: number,
    v: number,
    type: "Call" | "Put",
    isShort: boolean = false
) {
    if (T <= 0) return isShort ? 100 : 0;

    const d1 = (Math.log(S / K) + (r + (v * v) / 2) * T) / (v * Math.sqrt(T));
    const d2 = d1 - v * Math.sqrt(T);

    // Probability of S_T > K is N(d2)
    const probITMCall = cnd(d2);
    const probITMPut = 1 - cnd(d2);

    let pop = 0;
    if (type === "Call") {
        pop = isShort ? (1 - probITMCall) : probITMCall;
    } else {
        pop = isShort ? (1 - probITMPut) : probITMPut;
    }

    return parseFloat((pop * 100).toFixed(2));
}
