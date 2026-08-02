"use server";

import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function runAgenticAnalysis(symbol: string) {
    try {
        // 1. Try to fetch data using official Webull OpenAPI Python SDK
        let closes: number[] = [];
        let usingWebull = true;
        
        try {
            const webullScriptPath = path.join(process.cwd(), 'src', 'lib', 'agentic-desk', 'fetch_webull.py');
            const { stdout } = await execAsync(`python "${webullScriptPath}" "${symbol}"`, {
                env: { ...process.env, PYTHONIOENCODING: 'utf8', PYTHONUTF8: '1' }
            });
            
            const webullData = JSON.parse(stdout.trim());
            if (webullData.error || !webullData.close || webullData.close.length < 200) {
                console.warn(`Webull API returned error or insufficient data for ${symbol}. Falling back to Yahoo Finance.`, webullData.error);
                usingWebull = false;
            } else {
                closes = webullData.close;
                console.log(`Successfully fetched data for ${symbol} using Webull OpenAPI SDK!`);
            }
        } catch (webullError) {
            console.error(`Webull API script failed for ${symbol}:`, webullError);
            usingWebull = false;
        }
        
        // 2. Fallback to Yahoo Finance if Webull is unauthorized/pending
        if (!usingWebull) {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 365); // 1 year back
            
            const chartData = await yahooFinance.chart(symbol, {
                period1: startDate,
                interval: '1d'
            });
            
            const historical = chartData.quotes.filter((q: any) => q.close !== null);

            if (historical.length < 200) {
                throw new Error("Not enough historical data to compute EMA 200.");
            }

            closes = historical.map((day: any) => day.close);
        }

        // Prepare the input JSON for the scoring engine
        const inputData = {
            symbol: symbol,
            close: closes,
            macro_score: 0, // Default neutral macro for now
            holding: false
        };

        const tmpDir = path.join(process.cwd(), 'tmp');
        await fs.mkdir(tmpDir, { recursive: true });
        
        const tmpFile = path.join(tmpDir, `${symbol}_input.json`);
        await fs.writeFile(tmpFile, JSON.stringify(inputData));

        // Run the python script
        const scriptPath = path.join(process.cwd(), 'src', 'lib', 'agentic-desk', 'score.py');
        const { stdout, stderr } = await execAsync(`python "${scriptPath}" "${tmpFile}" --json`, {
            env: { ...process.env, PYTHONIOENCODING: 'utf8', PYTHONUTF8: '1' }
        });

        // Clean up
        await fs.unlink(tmpFile).catch(() => {});

        return JSON.parse(stdout);
    } catch (error: any) {
        console.error("Agentic Analysis Error:", error);
        return { error: error.message };
    }
}
export async function runMarketScanner(tickers: string[] = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'SPY', 'QQQ']) {
    const promises = tickers.map(async (symbol) => {
        try {
            const data = await runAgenticAnalysis(symbol);
            if (!data.error) {
                return data;
            }
        } catch (e: any) {
            console.error(`Error scanning ${symbol}:`, e);
        }
        return null;
    });
    
    const results = (await Promise.all(promises)).filter(r => r !== null);
    
    // Sort by pillar total descending
    results.sort((a, b) => b.pillar_total - a.pillar_total);
    
    return results;
}
