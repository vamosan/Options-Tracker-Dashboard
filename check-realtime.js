
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

async function checkRealTimeAccess() {
    console.log("--- Checking Real-Time Options Access ---");

    // 1. Get a valid recent contract
    console.log("Fetching a contract for SPY...");
    const contractsRes = await fetchPolygon("/v3/reference/options/contracts", {
        underlying_ticker: "SPY",
        limit: "1",
        expired: "false",
        order: "asc",
        sort: "strike_price"
    });

    if (!contractsRes?.results?.[0]) {
        console.error("Failed to get a contract to test.");
        return;
    }

    const contractTicker = contractsRes.results[0].ticker;
    console.log(`Testing with contract: ${contractTicker}`);

    // 2. Try Last Trade (Real-Time/15min delayed usually requires paid, but let's check)
    // Endpoint: /v2/last/trade/{optionsTicker}
    console.log(`Attempting v2/last/trade/${contractTicker}...`);
    const lastTrade = await fetchPolygon(`/v2/last/trade/${contractTicker}`);

    if (lastTrade && lastTrade.results) {
        console.log("SUCCESS: Access to Last Trade endpoint!");
        console.log("Data:", lastTrade.results);
    } else {
        console.log("FAIL: No access to Last Trade endpoint or no data.");
    }

    // 3. Try Intraday Aggregates (Bar data for today)
    // /v2/aggs/ticker/{optionsTicker}/range/1/minute/{today}/{today}
    const today = new Date().toISOString().split('T')[0];
    console.log(`Attempting Intraday Aggs for ${today}...`);
    const intraday = await fetchPolygon(`/v2/aggs/ticker/${contractTicker}/range/1/minute/${today}/${today}`, {
        adjusted: "true",
        sort: "desc",
        limit: "1"
    });

    if (intraday && intraday.results) {
        console.log("SUCCESS: Access to Intraday Aggs!");
        console.log("Data:", intraday.results);
    } else {
        console.log("FAIL: No access to Intraday Aggs or no trades today.");
    }
}

checkRealTimeAccess();
