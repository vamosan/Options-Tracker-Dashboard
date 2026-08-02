import { analyzeTrade, fetchSmartMoneyFlow } from './src/app/actions';

async function test() {
    console.log("Testing fetchSmartMoneyFlow...");
    try {
        const flow = await fetchSmartMoneyFlow();
        console.log("Flow result:", flow);
    } catch (e) {
        console.error("Flow error:", e);
    }

    console.log("\nTesting analyzeTrade...");
    try {
        const analysis = await analyzeTrade({
            id: "1",
            symbol: "AAPL",
            type: "Call",
            strike: 150,
            expiration: "2024-12-31",
            premium: 5,
            quantity: 1,
            currentPrice: 6,
            marketValue: 600,
            pl: 100,
            status: "OPEN"
        });
        console.log("Analysis result:", analysis);
    } catch (e) {
        console.error("Analysis error:", e);
    }
}

test();
