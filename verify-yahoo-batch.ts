import yahooFinance from "yahoo-finance2";

async function verifyYahooBatch() {
    const topTickers = ["NVDA", "TSLA", "AAPL", "AMD", "SPY", "QQQ", "AMZN", "MSFT", "META", "GOOGL"];
    try {
        // Instantiate first according to error msg
        let yf = yahooFinance;
        if (typeof yf === 'function') {
            yf = new (yf as any)();
        }

        const quotes = await yf.quote(topTickers);
        console.log(`Fetched ${quotes.length} quotes!`);
        console.log("AAPL Price:", quotes.find((q: any) => q.symbol === "AAPL")?.regularMarketPrice);
    } catch (e) {
        console.error("Batch fetch failed:", e);
    }
}

verifyYahooBatch();
