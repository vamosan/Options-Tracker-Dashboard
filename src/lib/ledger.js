const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL;
const dbPath = isVercel ? path.join('/tmp', 'ledger.sqlite') : path.resolve(process.cwd(), 'ledger.sqlite');
const db = new sqlite3.Database(dbPath);

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
    `, () => {
        // Seed database if running on Vercel so it's not totally empty on demo loads
        if (isVercel) {
            db.get("SELECT COUNT(*) as count FROM signals", (err, row) => {
                if (!err && row.count === 0) {
                    const stmt = db.prepare(`INSERT INTO signals (symbol, action, rationale, entry_price, confidence_score) VALUES (?, ?, ?, ?, ?)`);
                    stmt.run(['NVDA', 'CALL 150', 'Explosive upside flow > 500k premium', 135.50, 95]);
                    stmt.run(['TSLA', 'PUT 200', 'Bearish institutional sweep', 212.30, 88]);
                    stmt.run(['SPY', 'CALL 550', 'Trend continuation breakout', 545.10, 92]);
                    stmt.finalize();
                }
            });
        }
    });
});

/**
 * Log a new signal to the ledger
 */
function logSignal(symbol, action, rationale, entryPrice, confidenceScore = 0) {
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
