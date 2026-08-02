const yahooFinance = require('yahoo-finance2').default;

async function testNews(symbol) {
    try {
        console.log(`Fetching news for ${symbol}...`);
        const result = await yahooFinance.search(symbol, { newsCount: 5 });

        if (result && result.news && result.news.length > 0) {
            console.log('News found:');
            result.news.forEach(item => {
                console.log({
                    title: item.title,
                    publisher: item.publisher,
                    link: item.link,
                    providerPublishTime: new Date(item.providerPublishTime * 1000).toISOString(),
                    // Check for any sentiment-like fields (usually none in standard search, but worth verifying)
                    ...item
                });
            });
        } else {
            console.log('No news found via search.');
        }

        // specific news endpoint if exists (less documented in standard usage, sometimes 'quote' has it)
    } catch (error) {
        console.error('Error:', error);
    }
}

testNews('NVDA');
