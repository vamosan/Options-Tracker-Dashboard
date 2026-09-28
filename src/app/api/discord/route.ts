import { NextResponse } from 'next/server';
import { 
  sendDiscordWebhook, 
  sendTradeEntryCallout, 
  sendTradeExitCallout, 
  sendDailyCalloutsSummary, 
  sendTestSignal,
  DEFAULT_DISCORD_WEBHOOK_URL
} from '@/lib/discord';

export async function GET() {
  const webhookConfigured = Boolean(process.env.DISCORD_WEBHOOK_URL || DEFAULT_DISCORD_WEBHOOK_URL);
  return NextResponse.json({
    status: 'ok',
    configured: webhookConfigured,
    webhookUrlMasked: DEFAULT_DISCORD_WEBHOOK_URL ? DEFAULT_DISCORD_WEBHOOK_URL.replace(/(webhooks\/\d+\/)(.{6}).*/, '$1$2******') : null
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, payload, webhookUrl } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Missing action in request body' }, { status: 400 });
    }

    if (action === 'test') {
      const result = await sendTestSignal();
      return NextResponse.json({ success: result.success, message: 'Test signal sent to Discord', details: result });
    }

    if (action === 'entry') {
      if (!payload || !payload.symbol || !payload.entryTime || !payload.entryPrice) {
        return NextResponse.json({ success: false, error: 'Invalid entry payload: symbol, entryTime, and entryPrice required' }, { status: 400 });
      }
      const result = await sendTradeEntryCallout(payload);
      return NextResponse.json({ success: result.success, message: `Entry call-out sent for ${payload.symbol}`, details: result });
    }

    if (action === 'exit') {
      if (!payload || !payload.symbol || !payload.exitTime || !payload.exitPrice) {
        return NextResponse.json({ success: false, error: 'Invalid exit payload: symbol, exitTime, and exitPrice required' }, { status: 400 });
      }
      const result = await sendTradeExitCallout(payload);
      return NextResponse.json({ success: result.success, message: `Exit alert sent for ${payload.symbol}`, details: result });
    }

    if (action === 'daily-summary') {
      if (!payload || !payload.date || !Array.isArray(payload.trades)) {
        return NextResponse.json({ success: false, error: 'Invalid daily summary payload: date and trades array required' }, { status: 400 });
      }
      const result = await sendDailyCalloutsSummary(payload);
      return NextResponse.json({ success: result.success, message: `Daily call-outs summary sent for ${payload.date}`, details: result });
    }

    if (action === 'custom') {
      const result = await sendDiscordWebhook(payload, webhookUrl);
      return NextResponse.json({ success: result.success, message: 'Custom payload sent to Discord', details: result });
    }

    return NextResponse.json({ success: false, error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('[API /api/discord] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
