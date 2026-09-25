const https = require('https');

const options = {
  hostname: 'data.alpaca.markets',
  path: '/v1beta1/options/snapshots/AAPL240119C00150000',
  method: 'GET',
  headers: {
    'APCA-API-KEY-ID': 'PKWRCURWLNXPT2TBFR3WKS3U44',
    'APCA-API-SECRET-KEY': 'HddJhbAp2r9mSRs8GpNTgMPTYHzmJc9zjWwyKhJyRCX2'
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});
req.on('error', error => console.error(error));
req.end();
