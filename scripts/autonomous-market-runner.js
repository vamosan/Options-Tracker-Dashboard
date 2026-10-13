const fs = require('fs');
const path = require('path');

const LEDGER_PATH = path.resolve(__dirname, '..', 'data', 'live-ledger.json');
const CLOUD_CRON_URL = "https://options-tracker-chi.vercel.app/api/cloud-cron";

async function run() {
    console.log(`[${new Date().toISOString()}] Autonomous Market Runner starting...`);

    // ET Market Hours Check
    const now = new Date();
    const etString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
    const etDate = new Date(etString);
    const dayOfWeek = etDate.getDay();
    const hours = etDate.getHours();
    const minutes = etDate.getMinutes();
    const timeVal = hours * 100 + minutes;

    console.log(`[ET Time]: ${hours}:${String(minutes).padStart(2, '0')} (Day ${dayOfWeek})`);

    // Guard: Weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        console.log("Market closed: Weekend. Exiting cleanly.");
        return;
    }

    // Guard: Outside market hours (9:15 AM - 4:05 PM ET)
    if (timeVal < 915 || timeVal > 1605) {
        console.log("Market closed: Outside regular market hours (9:15 AM - 4:05 PM ET). Exiting cleanly.");
        return;
    }

    try {
        console.log(`Pinging Cloud Scanner at: ${CLOUD_CRON_URL}`);
        const res = await fetch(CLOUD_CRON_URL, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) {
            console.error(`Cloud Cron error: HTTP ${res.status}`);
            const text = await res.text();
            console.error(text);
            return;
        }

        const data = await res.json();
        console.log("Cloud Cron response:", JSON.stringify({
            status: data.status,
            session: data.session,
            timeET: data.timeET,
            actionsTriggered: data.actionsTriggered,
            recordedTradesCount: data.recordedTrades?.length || 0
        }, null, 2));

        if (Array.isArray(data.recordedTrades) && data.recordedTrades.length > 0) {
            console.log(`Received ${data.recordedTrades.length} recorded trade updates!`);

            let currentLedger = [];
            if (fs.existsSync(LEDGER_PATH)) {
                try {
                    currentLedger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8'));
                } catch (e) {
                    currentLedger = [];
                }
            }

            let hasUpdates = false;
            for (const newTrade of data.recordedTrades) {
                const existingIdx = currentLedger.findIndex(t => t.id === newTrade.id);
                if (existingIdx >= 0) {
                    currentLedger[existingIdx] = { ...currentLedger[existingIdx], ...newTrade };
                    hasUpdates = true;
                    console.log(`Updated trade record: ${newTrade.id}`);
                } else {
                    currentLedger.unshift(newTrade);
                    hasUpdates = true;
                    console.log(`Added new trade record: ${newTrade.id} (${newTrade.symbol})`);
                }
            }

            if (hasUpdates) {
                fs.writeFileSync(LEDGER_PATH, JSON.stringify(currentLedger, null, 2), 'utf-8');
                console.log(`Persisted updates to ${LEDGER_PATH}`);
            }
        } else {
            console.log("No new trades triggered on this tick. Ledger unchanged.");
        }

    } catch (err) {
        console.error("Runner execution failed:", err.message);
    }
}

run();
