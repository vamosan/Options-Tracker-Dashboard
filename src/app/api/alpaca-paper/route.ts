import { NextRequest, NextResponse } from 'next/server';
import {
  fetchAlpacaPaperPortfolio,
  placeAlpacaPaperOptionOrder,
} from '@/lib/alpacaClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  const portfolio = await fetchAlpacaPaperPortfolio();
  return NextResponse.json({
    success: portfolio.connected,
    ...portfolio,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      underlying,
      strike,
      direction = 'CALL',
      qty = 3,
      allowZeroDte = false,
    } = body;

    if (!underlying || !strike) {
      return NextResponse.json(
        { success: false, error: 'Missing underlying symbol or strike price' },
        { status: 400 }
      );
    }

    const result = await placeAlpacaPaperOptionOrder({
      underlying: String(underlying).toUpperCase(),
      strike: Number(strike),
      direction: String(direction).toUpperCase() === 'PUT' ? 'PUT' : 'CALL',
      qty: Number(qty) || 3,
      allowZeroDte: Boolean(allowZeroDte),
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to place Alpaca Paper option order',
      },
      { status: 500 }
    );
  }
}
