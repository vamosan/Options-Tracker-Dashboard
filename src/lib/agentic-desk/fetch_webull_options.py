import sys
import json
from webull.data.data_client import DataClient
from webull.core.client import ApiClient
from webull.data.request.get_option_contracts_request import GetOptionContractsRequest
import logging

logging.getLogger('webull').setLevel(logging.WARNING)

def fetch_options(symbol):
    api = ApiClient(app_key="1d11896bbcfcb506b5c10141d2d8998a", app_secret="cbe4a6a9186aa5dbdb11e7c67022477a", region_id="us")
    api.set_stream_logger(stream=None)
    client = DataClient(api)
    
    try:
        res = client.instrument.get_option_contracts(underlying_symbols=symbol)
        print(json.dumps({"raw_res": res}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing symbol argument"}))
        sys.exit(1)
    
    fetch_options(sys.argv[1])
