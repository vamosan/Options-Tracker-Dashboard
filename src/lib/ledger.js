const path = require('path');
const fs = require('fs');

const LEDGER_FILE = path.resolve(process.cwd(), 'data', 'live-ledger.json');
const RAW_GITHUB_URL = "https://raw.githubusercontent.com/vamosan/Options-Tracker-Dashboard/main/data/live-ledger.json";

function readLocalLedger() {
    try {
        if (fs.existsSync(LEDGER_FILE)) {
            const raw = fs.readFileSync(LEDGER_FILE, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn("Failed to read local ledger file:", e.message);
    }
    return [];
}

function writeLocalLedger(data) {
    try {
        fs.writeFileSync(LEDGER_FILE, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.warn("Failed to write local ledger file:", e.message);
        return false;
    }
}

/**
 * Log a new signal to the ledger
 */
async function logSignal(symbol, action, rationale, entryPrice, confidenceScore = 0) {
    const list = readLocalLedger();
    const newEntry = {
        id: `sig_${Date.now()}_${symbol}`,
        timestamp: new Date().toISOString(),
        symbol,
        action,
        rationale,
        entry_price: entryPrice,
        max_profit_pct: 0,
        win_status: 'OPEN_LIVE',
        confidence_score: confidenceScore
    };
    list.unshift(newEntry);
    writeLocalLedger(list);
    return newEntry.id;
}

/**
 * Fetch all signals (attempts live GitHub raw source first on serverless to bypass build cache)
 */
async function getSignals() {
    try {
        if (process.env.VERCEL) {
            const res = await fetch(`${RAW_GITHUB_URL}?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Accept': 'application/json' }
            });
            if (res.ok) {
                const liveData = await res.json();
                if (Array.isArray(liveData)) return liveData;
            }
        }
    } catch (err) {
        console.warn("Failed to fetch live ledger from GitHub raw:", err.message);
    }
    return readLocalLedger();
}

/**
 * Update the backtest result (max_profit_pct and win_status)
 */
async function updateSignalResult(id, maxProfitPct, winStatus) {
    const list = readLocalLedger();
    const target = list.find(s => s.id === id || s.symbol === id);
    if (target) {
        target.max_profit_pct = maxProfitPct;
        target.win_status = winStatus;
        writeLocalLedger(list);
        return 1;
    }
    return 0;
}

module.exports = {
    logSignal,
    getSignals,
    updateSignalResult,
    readLocalLedger,
    writeLocalLedger
};
