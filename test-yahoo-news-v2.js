const yahooFinance = require('yahoo-finance2').default;

async function testNews(symbol) {
    try {
        console.log(`Fetching news for ${symbol}...`);
        // Try search first
        const result = await yahooFinance.search(symbol, { newsCount: 5 });
        console.log('Search Result Keys:', Object.keys(result));

        if (result.news) {
            console.log('News found in search:', result.news.length);
            console.log(JSON.stringify(result.news.slice(0, 2), null, 2));
        } else {
            console.log('No .news in search result');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testNews('NVDA');
