const yahooFinance = require('yahoo-finance2').default;

// Suppress console.warn effectively
const originalWarn = console.warn;
console.warn = (...args) => {
    if (args[0] && args[0].includes && args[0].includes('cookie')) return;
    originalWarn.apply(console, args);
};

async function test() {
    try {
        const symbol = 'SPY';
        // Try basic quote first to see if connectivity works at all
        const quote = await yahooFinance.quote(symbol);
        console.log('Quote success:', quote.regularMarketPrice);

        const queryOptions = { lang: 'en-US', region: 'US' };
        const result = await yahooFinance.options(symbol, queryOptions);

        console.log('Successfully fetched options chain for SPY');
        if (result.options && result.options.length > 0) {
            console.log('First expiration date:', result.options[0].expirationDate);
            console.log('Sample Call:', result.options[0].calls[0]);
        } else {
            console.log('No options found.');
        }

    } catch (error) {
        console.error('Error fetching options:', error.message || error);
    }
}

test();
