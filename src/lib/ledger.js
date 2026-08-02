const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(process.cwd(), 'ledger.sqlite');
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
    `);
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
