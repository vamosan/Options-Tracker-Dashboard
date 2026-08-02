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

async function testFlow() {
    try {
        console.log("1. Finding active SPY contracts...");
        // Get a near-the-money SPY call expiring soon
        const contractsUrl = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=SPY&contract_type=call&expired=false&limit=1&apiKey=${API_KEY}`;
        const contractsData = await fetchJson(contractsUrl);

        if (!contractsData.results || contractsData.results.length === 0) {
            console.error("No contracts found.");
            return;
        }

        const contract = contractsData.results[0];
        console.log(`Testing Contract: ${contract.ticker}`);

        // 2. Fetch TRADES for this contract (The "Flow")
        // Trying to get recent trades. For delayed data, we might need to look back 15-20 mins.
        // Or just ask for the last 50 trades.
        const tradesUrl = `https://api.polygon.io/v3/trades/${contract.ticker}?limit=5&apiKey=${API_KEY}`;

        console.log(`Fetching Trades: ${tradesUrl.replace(API_KEY, "REDACTED")}`);
        const tradesData = await fetchJson(tradesUrl);

        if (tradesData.results && tradesData.results.length > 0) {
            console.log("\n✅ Success! Found recent trades (Flow Data):");
            tradesData.results.forEach(t => {
                const time = new Date(t.participant_timestamp / 1000000).toISOString();
                console.log(`- Time: ${time} | Size: ${t.size} | Price: $${t.price}`);
            });
        } else {
            console.log("⚠️ No trades found or API restriction:", tradesData);
        }

        // 3. Fallback: Aggregates (if trades are restricted)
        const aggUrl = `https://api.polygon.io/v2/aggs/ticker/${contract.ticker}/prev?adjusted=true&apiKey=${API_KEY}`;
        console.log(`\nChecking Aggregates (Backup):`);
        const aggData = await fetchJson(aggUrl);
        console.log(JSON.stringify(aggData, null, 2));

    } catch (e) {
        console.error("Error:", e);
    }
}

testFlow();
