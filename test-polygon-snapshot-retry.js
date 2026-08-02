const https = require('https');

const API_KEY = "zEM9My3zdaVqDpeZex81d9iKODfjR610";

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        resolve({ error: `Status ${res.statusCode}`, data: data });
                    } else {
                        resolve(JSON.parse(data));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error("Request timed out"));
        });
    });
}

async function testSnapshot() {
    try {
        console.log("Testing Options Chain Snapshot for SPY (Lite)...");
        // Use a more specific query to reduce load
        const url = `https://api.polygon.io/v3/snapshot/options/SPY?limit=5&apiKey=${API_KEY}`;

        const data = await fetchJson(url);

        if (data.results) {
            console.log(`✅ Success! Found ${data.results.length} contracts.`);
            if (data.results.length > 0) {
                const sample = data.results[0];
                console.log("Sample:", sample.ticker);
                console.log("Day Volume:", sample.day?.v);
            }
        } else {
            console.log("⚠️ Failed:", data);
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

testSnapshot();
