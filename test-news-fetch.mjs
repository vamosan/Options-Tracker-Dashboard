import pkg from 'yahoo-finance2';

console.log('Export keys:', Object.keys(pkg));
// It seems yf is the instance itself in some versions or default export
const yahooFinance = pkg.default || pkg;

// Suppress the notice about the new instance
if (yahooFinance.suppressNotices) {
    yahooFinance.suppressNotices(['yahooSurvey']);
}

async function testNews() {
    try {
        console.log("Testing Market News ('Stock Market')...");
        // Suppress notice if needed, though import usually handles it
        // The global suppression above handles this now.

        const marketResult = await yahooFinance.search("Stock Market", { newsCount: 5 });
        console.log("Market Result News Count:", marketResult.news ? marketResult.news.length : 0);
        if (marketResult.news && marketResult.news.length > 0) {
            console.log("First Article:", marketResult.news[0].title);
        } else {
            console.log("Raw Market Result:", JSON.stringify(marketResult, null, 2));
        }

        console.log("\nTesting Ticker News ('AAPL')...");
        const tickerResult = await yahooFinance.search("AAPL", { newsCount: 5 });
        console.log("Ticker Result News Count:", tickerResult.news ? tickerResult.news.length : 0);
        if (tickerResult.news && tickerResult.news.length > 0) {
            console.log("First Article:", tickerResult.news[0].title);
        } else {
            console.log("Raw Ticker Result:", JSON.stringify(tickerResult, null, 2));
        }

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testNews();
