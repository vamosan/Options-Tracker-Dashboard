const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
        console.log("Navigating to live site...");
        await page.goto('https://options-tracker-chi.vercel.app', { waitUntil: 'networkidle' });

        // Check if the page loaded at all
        const title = await page.title();
        console.log(`Page title: ${title}`);

        // Wait for the layout to render
        await page.waitForTimeout(3000);

        // Take base screenshot
        await page.screenshot({ path: 'vercel-live-base.png' });
        console.log("Saved base screenshot");

        // Click the Pulse button
        try {
            // Find a button with 'Pulse' in it, or the top nav button
            await page.locator('button:has-text("Pulse")').first().click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: 'vercel-live-pulse.png' });
            console.log("Saved pulse sidebar screenshot");
        } catch (e) {
            console.log("Could not click Pulse button:", e.message);
        }

    } catch (error) {
        console.error("Error during screenshot:", error);
    } finally {
        await browser.close();
    }
})();
