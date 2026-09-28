const https = require('https');

const webhookUrl = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1554066969588801546/34cLxhk8Nr7FtYbscs3s4lhkhrfQYpWoSKxe-giiLSv6LHgd09YlJo6NSoDc-SAlkW1O';

const testEmbed = {
  title: '🔔 TEST SIGNAL: Real-Time Options Call-Out',
  description: '✅ **Discord Webhook Connected & Fully Operational**\nLive call-outs with precise Entry Time, Exit Time, and Gatekeeper verification are now connected.',
  color: 0x10B981, // Emerald Green
  fields: [
    {
      name: '📈 Symbol & Contract',
      value: '**CVS $86.00 CALL** (Weekly)',
      inline: true
    },
    {
      name: '⏱️ Entry Time',
      value: '`10:10 AM ET`',
      inline: true
    },
    {
      name: '🏁 Exit Time',
      value: '`02:30 PM ET`',
      inline: true
    },
    {
      name: '💵 Entry Premium',
      value: '**$1.35** ($135 / contract)',
      inline: true
    },
    {
      name: '🎯 Exit Premium',
      value: '**$2.45** ($245 / contract)',
      inline: true
    },
    {
      name: '📊 Outcome / Return',
      value: '**TARGET 2 HIT (+81.5%)**\n`+$110.00 / ct net`',
      inline: true
    },
    {
      name: '🛑 Stop Loss Boundary',
      value: '$1.01 (-25% strict capital guard)',
      inline: true
    },
    {
      name: '🎯 Profit Targets',
      value: 'T1: $1.75 (+30%)\nT2: $2.23 (+65%)',
      inline: true
    },
    {
      name: '🛡️ Gatekeeper Certification',
      value: '✅ Passed: RVOL 3.2x (>2.8x floor)\n✅ Passed: Midday breakout (>10:15 AM)\n✅ Passed: Bullish delta bar',
      inline: true
    },
    {
      name: '📝 Execution Commentary',
      value: 'Broke above $85.60 resistance shelf with heavy institutional volume delta. Price surged steadily from $85.60 to session high of $89.35. Contract achieved max gain of +81.5%.',
      inline: false
    }
  ],
  footer: {
    text: 'Options Tracker AI • Real-Time Discord Webhook Engine'
  },
  timestamp: new Date().toISOString()
};

const payload = JSON.stringify({
  username: 'Options Tracker AI • Real-Time Desk',
  avatar_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=128&auto=format&fit=crop&q=80',
  embeds: [testEmbed]
});

const parsed = new URL(webhookUrl);
const req = https.request({
  hostname: parsed.hostname,
  path: parsed.pathname + parsed.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  console.log('HTTP Status:', res.statusCode);
  if (res.statusCode === 204 || res.statusCode === 200) {
    console.log('SUCCESS: Test signal delivered to Discord webhook successfully!');
  } else {
    res.on('data', d => process.stdout.write(d));
  }
});

req.on('error', (e) => {
  console.error('Request failed:', e);
});

req.write(payload);
req.end();
