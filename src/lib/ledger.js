const path = require('path');

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL;
let db = null;

// Mock data for Vercel
let mockLedger = [
    { id: 1, timestamp: new Date().toISOString(), symbol: 'NVDA', action: 'CALL 150', rationale: 'Explosive upside flow > 500k premium', entry_price: 135.50, max_profit_pct: 0, win_status: 'PENDING', confidence_score: 95 },
    { id: 2, timestamp: new Date().toISOString(), symbol: 'TSLA', action: 'PUT 200', rationale: 'Bearish institutional sweep', entry_price: 212.30, max_profit_pct: 0, win_status: 'PENDING', confidence_score: 88 },
    { id: 3, timestamp: new Date().toISOString(), symbol: 'SPY', action: 'CALL 550', rationale: 'Trend continuation breakout', entry_price: 545.10, max_profit_pct: 0, win_status: 'PENDING', confidence_score: 92 }
];

if (!isVercel) {
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.resolve(process.cwd(), 'ledger.sqlite');
    db = new sqlite3.Database(dbPath);

    // Initialize table
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS signals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                symbol TEXT,
                action TEXT,
                rationale TEXT,
                entry_price REAL,
                max_profit_pct REAL DEFAULT 0,
                win_status TEXT DEFAULT 'PENDING',
                confidence_score REAL DEFAULT 0
            )
        `);
    });
}

/**
 * Log a new signal to the ledger
 */
function logSignal(symbol, action, rationale, entryPrice, confidenceScore = 0) {
    if (isVercel) {
        return Promise.resolve(mockLedger.length + 1);
    }
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`INSERT INTO signals (symbol, action, rationale, entry_price, confidence_score) VALUES (?, ?, ?, ?, ?)`);
        stmt.run([symbol, action, rationale, entryPrice, confidenceScore], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
        stmt.finalize();
    });
}

/**
 * Fetch all signals
 */
function getSignals() {
    if (isVercel) {
        return Promise.resolve(mockLedger);
    }
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM signals ORDER BY timestamp DESC", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

/**
 * Update the backtest result (max_profit_pct and win_status)
 */
function updateSignalResult(id, maxProfitPct, winStatus) {
    if (isVercel) {
        const signal = mockLedger.find(s => s.id === id);
        if (signal) {
            signal.max_profit_pct = maxProfitPct;
            signal.win_status = winStatus;
            return Promise.resolve(1);
        }
        return Promise.resolve(0);
    }
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`UPDATE signals SET max_profit_pct = ?, win_status = ? WHERE id = ?`);
        stmt.run([maxProfitPct, winStatus, id], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
        stmt.finalize();
    });
}

module.exports = {
    logSignal,
    getSignals,
    updateSignalResult
};
