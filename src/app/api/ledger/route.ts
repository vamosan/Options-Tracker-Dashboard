import { NextResponse } from 'next/server';
import { getSignals, updateSignalResult } from '@/lib/ledger';
import yahooFinance from 'yahoo-finance2';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const signals = await getSignals();
        return NextResponse.json(signals);
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
