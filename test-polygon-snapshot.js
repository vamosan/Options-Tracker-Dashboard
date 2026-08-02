const https = require('https');

const API_KEY = "zEM9My3zdaVqDpeZex81d9iKODfjR610";

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    console.log(`Response Status: ${res.statusCode}`);
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function testSnapshot() {
    try {
        console.log("Testing Options Chain Snapshot for SPY...");
        // Look for contracts expiring soon to keep it relevant
        // Note: Snapshot might return A LOT of data. We want to see if it lists volume.
        const url = `https://api.polygon.io/v3/snapshot/options/SPY?limit=10&apiKey=${API_KEY}`;

        const data = await fetchJson(url);

        if (data.results && data.results.length > 0) {
            console.log(`✅ Success! Found ${data.results.length} contracts.`);
            const sample = data.results[0];
            console.log("Sample Contract:", sample.details?.ticker || sample.ticker);
            console.log("Day Stats:", sample.day);
            console.log("Volume:", sample.day?.v);
        } else {
            console.log("⚠️ No data or error:", data);
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

testSnapshot();
