const yahooFinance = require('yahoo-finance2').default;

async function testYahoo() {
    // Standard test: AAPL $150 Call Expiring March 15, 2024 (Historical example format)
    // Or better, a 2026 one that might still be active.
    const tickers = [
        'SPY260116C00500000', // Jan 16, 2026 $500 Call
        'AAPL'                // Underlying for comparison
    ];

    for (const ticker of tickers) {
        try {
            console.log(`\n--- Testing Yahoo quote for ${ticker} ---`);
            const quote = await yahooFinance.quote(ticker);
            console.log(`Success! Price: ${quote.regularMarketPrice}`);
            // console.log(JSON.stringify(quote, null, 2));
        } catch (e) {
            console.error(`Error for ${ticker}:`, e.message);
        }
    }
}

testYahoo();
