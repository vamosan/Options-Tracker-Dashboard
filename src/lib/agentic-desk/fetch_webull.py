import sys
import json
import logging
from webull.core.client import ApiClient
from webull.data.data_client import DataClient
from webull.data.request.get_historical_bars_request import GetHistoricalBarsRequest

# Configure credentials
APP_KEY = '1d11896bbcfcb506b5c10141d2d8998a'
APP_SECRET = 'cbe4a6a9186aa5dbdb11e7c67022477a'
REGION = 'us'

def get_historical_data(symbol):
    try:
        api = ApiClient(app_key=APP_KEY, app_secret=APP_SECRET, region_id=REGION)
        # Suppress standard logging to prevent breaking json output
        api.set_stream_logger(stream=None)
        
        dc = DataClient(api)
        
        # Build request for last 250 daily bars
        req = GetHistoricalBarsRequest()
        req.set_symbol(symbol)
        req.set_category("EQUITY") # Just in case it's needed
        req.set_count('250')
        req.set_timespan("d1")
        
        # Execute
        res = dc.market_data.get_history_bar(req)
        
        # Format the output for Next.js backend
        closes = []
        if res and hasattr(res, 'data') and res.data:
            # Assuming res.data is a list of bar dicts: {'close': '150.00', ...}
            for bar in res.data:
                closes.append(float(bar.get('close', 0)))
                
        return {
            "symbol": symbol,
            "close": closes,
            "macro_score": 0,
            "holding": False,
            "error": None
        }
    except Exception as e:
        return {
            "symbol": symbol,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing symbol"}))
        sys.exit(1)
        
    symbol = sys.argv[1].upper()
    data = get_historical_data(symbol)
    print(json.dumps(data))
