import { NextResponse } from 'next/server';
import { getSignals, updateSignalResult } from '@/lib/ledger';
import { fetchTodayAlpacaOptionTrades } from '@/lib/alpacaClient';
import { SECTOR_AGNOSTIC_UNIVERSE } from '@/lib/agenticOrchestrator';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const signals = (await getSignals()) || [];
        const estNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const todayIsoStr = `${estNow.getFullYear()}-${String(estNow.getMonth() + 1).padStart(2, '0')}-${String(estNow.getDate()).padStart(2, '0')}`;
        const alpacaTradesMap = await fetchTodayAlpacaOptionTrades(todayIsoStr);

        const merged = [...signals];
        alpacaTradesMap.forEach((t, sym) => {
            if (sym === 'SPY' || sym === 'QQQ') return;
            const existsIdx = merged.findIndex((s: any) => s.date === todayIsoStr && s.symbol === sym);
            const meta = SECTOR_AGNOSTIC_UNIVERSE.find((u) => u.symbol === sym);
            const contractLabel = `${sym} $${t.strike}${t.direction === 'PUT' ? 'P' : 'C'}`;
            const pnlPerCt = Math.round((t.currentPrice - t.avgEntryPrice) * 100);
            const pctNum = t.avgEntryPrice > 0 ? ((t.currentPrice - t.avgEntryPrice) / t.avgEntryPrice) * 100 : 0;
            const liveRecord = {
                id: `trade_${todayIsoStr.replace(/-/g, '')}_${sym.toLowerCase()}`,
                date: todayIsoStr,
                timestamp: new Date().toISOString(),
                symbol: sym,
                name: meta?.name || sym,
                contract: contractLabel,
                action: `BUY ${contractLabel} [${t.occSymbol}]`,
                time: '10:16 AM',
                entryTime: '10:16 AM',
                exitTime: t.status === 'OPEN_POSITION' ? 'Active Position' : 'Closed',
                duration: 'Live',
                session: 'MORNING_ORB',
                entryPrice: t.avgEntryPrice,
                target1: Math.round(t.avgEntryPrice * 1.30 * 100) / 100,
                target2: Math.round(t.avgEntryPrice * 1.65 * 100) / 100,
                stopLoss: Math.round(t.avgEntryPrice * 0.75 * 100) / 100,
                peakPrice: Math.max(t.avgEntryPrice, t.currentPrice),
                outcome: 'OPEN_LIVE',
                pnlPerContract: pnlPerCt,
                percentGain: `${pctNum >= 0 ? '+' : ''}${pctNum.toFixed(1)}%`,
                rationale: `Live Alpaca Paper Position: ${t.qty}x ${t.occSymbol} filled @ $${t.avgEntryPrice.toFixed(2)} (Current: $${t.currentPrice.toFixed(2)})`,
                catalyst: meta?.catalyst || `Institutional ${t.direction} Execution`,
                rvol: meta?.rvolExpectation || '3.0x',
                confidenceScore: 98,
                winStatus: pnlPerCt >= 0 ? 'WIN' : 'PENDING',
            };
            if (existsIdx >= 0) {
                merged[existsIdx] = { ...merged[existsIdx], ...liveRecord };
            } else {
                merged.unshift(liveRecord);
            }
        });

        return NextResponse.json(merged);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, maxProfitPct, winStatus } = body;
        
        if (!id || typeof maxProfitPct !== 'number' || !winStatus) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        await updateSignalResult(id, maxProfitPct, winStatus);
        
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
