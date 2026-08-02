const YahooFinance = require('yahoo-finance2').default || require('yahoo-finance2');
const yahooFinance = new YahooFinance();
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');

const execAsync = promisify(exec);

const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'SPY', 'QQQ'];

async function scanTickers() {
    console.log("Scanning MAG7 + SPY/QQQ for best opportunities today...\n");
    const results = [];
    
    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });

    for (const symbol of TICKERS) {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 365);
            
            const chartData = await yahooFinance.chart(symbol, {
                period1: startDate,
                interval: '1d'
            });
            const historical = chartData.quotes.filter(q => q.close !== null);
            const closes = historical.map(day => day.close);
            
            const inputData = {
                symbol: symbol,
                close: closes,
                macro_score: 0,
                holding: false
            };
            
            const tmpFile = path.join(tmpDir, `${symbol}_test.json`);
            await fs.writeFile(tmpFile, JSON.stringify(inputData));
            
            const scriptPath = path.join(process.cwd(), 'src', 'lib', 'agentic-desk', 'score.py');
            const { stdout } = await execAsync(`python "${scriptPath}" "${tmpFile}" --json`, {
                env: { ...process.env, PYTHONIOENCODING: 'utf8', PYTHONUTF8: '1' }
            });
            
            const result = JSON.parse(stdout.trim());
            results.push(result);
        } catch (e) {
            console.error(`Error processing ${symbol}:`, e.message);
        }
    }
    
    // Sort by overall pillar total descending
    results.sort((a, b) => b.pillar_total - a.pillar_total);
    
    console.log("=== SCAN RESULTS ===\n");
    for (const r of results) {
        console.log(`${r.symbol.padEnd(5)} | Score: ${String(r.pillar_total).padStart(2)} | Action: ${r.decision.action.padEnd(16)} | Trend: ${r.pillars.trend.score}, Mom: ${r.pillars.momentum.score}`);
        console.log(`        Rationale: ${r.decision.rationale}`);
    }
    
    // Create artifact content
    const artifact = `# Daily Opportunities Scanner

This report scans the Magnificent 7 alongside SPY and QQQ using our Agentic Trading Desk Python engine.

## Ranked Opportunities (By Three-Pillar Score)
${results.map(r => `
### ${r.symbol} (Score: ${r.pillar_total})
**Action**: \`${r.decision.action}\`
**Trend**: ${r.pillars.trend.score} | **Momentum**: ${r.pillars.momentum.score}
* ${r.decision.rationale}
* Active Flags: ${Object.values(r.decision.flags).flat().join(", ") || 'None'}
`).join("")}
`;
    
    await fs.writeFile(path.join(process.cwd(), 'scan_results.md'), artifact);
}

scanTickers();
