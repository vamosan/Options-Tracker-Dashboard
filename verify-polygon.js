const fs = require('fs');
const https = require('https');
const path = require('path');

// 1. Read API Key
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/POLYGON_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : null;

if (!apiKey) {
    console.error("API Key not found in .env.local");
    process.exit(1);
}

// Helper to fetch JSON
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
                    console.log("Raw Response:", data);
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function verify() {
    try {
        console.log("1. Searching for a valid SPY option contract...");
        const contractsUrl = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=SPY&limit=1&apiKey=${apiKey}`;
        const contractsData = await fetchJson(contractsUrl);

        if (!contractsData.results || contractsData.results.length === 0) {
            console.error("No contracts found.", JSON.stringify(contractsData));
            return;
        }

        const contract = contractsData.results[0];
        console.log("Found Contract:", contract.ticker);

        const today = new Date().toISOString().split('T')[0];
        console.log("2. Fetching AGGREGATES for:", contract.ticker, "on", today);
        const aggUrl = `https://api.polygon.io/v2/aggs/ticker/${contract.ticker}/range/1/minute/${today}/${today}?adjusted=true&sort=desc&limit=1&apiKey=${apiKey}`;
        const aggData = await fetchJson(aggUrl);

        console.log("Aggregates Result:");
        console.log(JSON.stringify(aggData, null, 2));

    } catch (e) {
        console.error("Excep:", e);
    }
}

verify();
