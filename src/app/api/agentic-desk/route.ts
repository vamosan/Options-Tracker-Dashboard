import { NextResponse } from 'next/server';
import { runAgenticDailyConsensus } from '@/lib/agenticOrchestrator';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeVal = parseInt(searchParams.get('timeVal') || '930', 10);
    const consensus = await runAgenticDailyConsensus(timeVal);

    return NextResponse.json({
      success: true,
      data: consensus
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Agentic analysis failed'
    }, { status: 500 });
  }
}
