const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('BROWSER CONSOLE ERROR:', msg.text());
        }
    });

    page.on('pageerror', err => {
        console.log('BROWSER PAGE EXCEPTION:', err.toString());
    });

    try {
        console.log('Navigating to local dev server...');
        await page.goto('http://127.0.0.1:3008', { waitUntil: 'networkidle0', timeout: 10000 });
        await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
        console.log("Error loading page: ", e.message);
    } finally {
        await browser.close();
    }
})();
