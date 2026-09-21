"use server";

import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
import { scoreSymbol } from '@/lib/agentic-desk/score';

export async function runAgenticAnalysis(symbol: string) {
    try {
        let closes: number[] = [];
        
        // Fetch data using Yahoo Finance
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

        // Run the agentic scoring logic directly in Node.js/TypeScript!
        const scoreResult = scoreSymbol(closes, symbol, 0, false);
        return scoreResult;

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
