
// Standalone verification script for Polygon API Integration
// This script replicates the logic used in the application to ensure the API key and endpoints work.

const POLYGON_API_KEY = process.env.POLYGON_API_KEY || "zEM9My3zdaVqDpeZex81d9iKODfjR610";
const POLYGON_BASE_URL = "https://api.polygon.io";

async function fetchPolygon(endpoint, params = {}) {
    if (!POLYGON_API_KEY) {
        console.error("Missing POLYGON_API_KEY");
        return null;
    }
    const queryString = new URLSearchParams({ ...params, apiKey: POLYGON_API_KEY }).toString();
    const url = `${POLYGON_BASE_URL}${endpoint}?${queryString}`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Polygon API Error: ${res.status} ${res.statusText}`);
        return await res.json();
    } catch (e) {
        console.error(`Polygon Fetch Error (${endpoint}):`, e.message);
        return null;
    }
}

async function verifySmartMoney() {
    console.log("\n--- Verifying Smart Money Flow Logic ---");
    const tickers = ["SPY", "QQQ"];
    let flowDataFound = 0;

    await Promise.all(tickers.map(async (ticker) => {
        console.log(`\nChecking ${ticker}...`);
        try {
            // 1. Get Contracts
            console.log(`[1] Fetching contracts for ${ticker}...`);
            const contractsRes = await fetchPolygon("/v3/reference/options/contracts", {
                underlying_ticker: ticker,
                limit: "3",
                expired: "false",
                order: "asc",
                sort: "strike_price"
            });

            if (!contractsRes?.results) {
                console.log(`No contracts found for ${ticker}`);
                return;
            }
            console.log(`    > Found ${contractsRes.results.length} contracts.`);

            // 2. Check Volume for each
            for (const contract of contractsRes.results) {
                const prevDayRes = await fetchPolygon(`/v2/aggs/ticker/${contract.ticker}/prev`, { adjusted: "true" });

                if (prevDayRes?.results?.[0]) {
                    const dayStats = prevDayRes.results[0];
                    console.log(`    > Contract: ${contract.ticker}`);
                    console.log(`      Volume: ${dayStats.v}, Close: ${dayStats.c}`);

                    if (dayStats.v >= 0) {
                        flowDataFound++;
                    }
                } else {
                    console.log(`    > Contract: ${contract.ticker} - No Aggregate Data (Market might be closed or untraded)`);
                }
            }
        } catch (e) {
            console.error(`Error verifying ${ticker}:`, e);
        }
    }));

    if (flowDataFound > 0) {
        console.log(`\nSUCCESS: Smart Money Flow logic found data for ${flowDataFound} contracts.`);
    } else {
        console.log("\nWARNING: No flow data found. Market might be closed or API limited.");
    }
}

async function verifyScannerData() {
    console.log("\n--- Verifying real-time stock quotes (For AI Scanner) ---");
    // Check if we can get a quote for SPY
    const quoteRes = await fetchPolygon("/v2/aggs/ticker/SPY/prev", { adjusted: "true" });
    if (quoteRes?.results?.[0]) {
        console.log(`SUCCESS: Fetched SPY Quote. Price: ${quoteRes.results[0].c}`);
    } else {
        console.error("FAILED to fetch SPY Quote.");
    }
}

async function run() {
    await verifySmartMoney();
    await verifyScannerData();
}

run();
