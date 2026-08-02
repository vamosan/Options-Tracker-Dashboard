const YahooFinance = require('yahoo-finance2').default || require('yahoo-finance2');
const yahooFinance = new YahooFinance();
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');

const execAsync = promisify(exec);

async function testQQQ() {
    console.log("Fetching QQQ data...");
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 365);
    
    const chartData = await yahooFinance.chart("QQQ", {
        period1: startDate,
        interval: '1d'
    });
    const historical = chartData.quotes.filter(q => q.close !== null);
    const closes = historical.map(day => day.close);
    
    const inputData = {
        symbol: "QQQ",
        close: closes,
        macro_score: 0,
        holding: false
    };
    
    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `QQQ_test.json`);
    await fs.writeFile(tmpFile, JSON.stringify(inputData));
    
    console.log("Running Python engine...");
    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'agentic-desk', 'score.py');
    const { stdout, stderr } = await execAsync(`python "${scriptPath}" "${tmpFile}" --json`, {
        env: { ...process.env, PYTHONIOENCODING: 'utf8', PYTHONUTF8: '1' }
    });
    
    console.log("Result:");
    console.log(stdout);
}
testQQQ();
