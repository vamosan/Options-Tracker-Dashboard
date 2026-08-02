import { fetchOptionPrice, fetchStockPrice, analyzeTrade } from "./src/app/actions.ts";

async function verify() {
    console.log("Starting Verification...");

    // Create a mock active position
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);
    const expiry = nextMonth.toISOString().split('T')[0];

    const mockPosition = {
        id: "test-id-123",
        symbol: "AAPL",
        type: "Call",
        strike: 150, // deep ITM for a realistic test
        expiration: expiry,
        premium: 0.0,
        quantity: 1,
        currentPrice: 0,
        marketValue: 0,
        pl: 0,
        status: "OPEN",
        entryDate: today.toISOString(),
        entryTime: "09:30"
    };

    console.log("\n1. Testing fetchStockPrice (AAPL)...");
    const stockInfo = await fetchStockPrice("AAPL");
    console.log("Stock Info:", stockInfo);

    if (!stockInfo || stockInfo.price <= 0) {
        console.error("FAIL: Could not fetch underlying stock price.");
        process.exit(1);
    }

    console.log(`\n2. Testing fetchOptionPrice (AAPL ${expiry} ${mockPosition.strike} Call)...`);
    const optPrice = await fetchOptionPrice("AAPL", "Call", mockPosition.strike, expiry);
    console.log(`Option Price: $${optPrice}`);

    if (optPrice === null || optPrice === stockInfo.price) {
        console.warn("WARNING: Option price is null or exactly matches stock price. The OCC symbol might be wrong or no data exists.");
    }

    console.log("\n3. Testing analyzeTrade (Greeks Calculation)...");
    // Set the price we found and analyze
    const testPos = { ...mockPosition, premium: optPrice || 10, currentPrice: optPrice || 10, pl: 0, marketValue: (optPrice || 10) * 100 };
    const analysis = await analyzeTrade(testPos as any);

    console.log("Greeks output:", analysis.greeks);

    if (analysis.greeks && analysis.greeks.delta !== 0) {
        console.log("SUCCESS: Greeks calculated successfully.");
    } else {
        console.error("FAIL: Greeks failed calculation or returned 0s.");
        process.exit(1);
    }
}

verify().catch(console.error);
