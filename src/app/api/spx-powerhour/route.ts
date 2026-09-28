import { NextResponse } from 'next/server';
import { getLiveSPXPowerHourData } from '@/lib/spxPowerHour';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const simulatePhase = searchParams.get('phase') as any;
    const simulateMOCDirection = searchParams.get('moc') as any;

    const data = await getLiveSPXPowerHourData({
      simulatePhase: simulatePhase || undefined,
      simulateMOCDirection: simulateMOCDirection || undefined,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API /api/spx-powerhour] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch SPX Power Hour data' }, { status: 500 });
  }
}
