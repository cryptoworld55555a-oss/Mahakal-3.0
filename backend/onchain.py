"""Reads the REAL PancakeSwap V2 TTN/USDT pool state from BSC mainnet via raw JSON-RPC.
No web3 dependency (avoids version conflicts). Returns live price + liquidity, or
{"live": False} before the pool is seeded. Cached briefly to avoid RPC spam."""
import os
import time
import json
import urllib.request

RPC = os.environ.get('BSC_RPC_URL', 'https://bsc-dataseed.binance.org')
FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'                 # PancakeSwap V2 factory (BSC)
USDT = '0x55d398326f99059fF775485246999027B3197955'                    # BSC-USD
TOKEN = os.environ.get('TOKEN_ADDRESS', '0x0000000000000000000000000000000000000000')

# Function selectors
SEL_GET_PAIR = '0xe6a43905'      # getPair(address,address)
SEL_GET_RESERVES = '0x0902f1ac'  # getReserves()
SEL_TOKEN0 = '0x0dfe1681'        # token0()

_cache = {"ts": 0, "data": None}
_TTL = 30  # seconds


def _addr32(a: str) -> str:
    return a.lower().replace('0x', '').rjust(64, '0')


def _eth_call(to: str, data: str):
    payload = json.dumps({
        "jsonrpc": "2.0", "id": 1, "method": "eth_call",
        "params": [{"to": to, "data": data}, "latest"],
    }).encode()
    req = urllib.request.Request(RPC, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=8) as r:
        res = json.loads(r.read().decode())
    return res.get("result", "0x")


def _read_pool():
    if TOKEN.lower() == '0x0000000000000000000000000000000000000000':
        return {"live": False}
    # 1) pair address from factory
    data = SEL_GET_PAIR + _addr32(TOKEN) + _addr32(USDT)
    res = _eth_call(FACTORY, data)
    pair = '0x' + res[-40:]
    if int(pair, 16) == 0:
        return {"live": False}
    # 2) reserves + token0
    rres = _eth_call(pair, SEL_GET_RESERVES)
    hexs = rres[2:] if rres.startswith('0x') else rres
    r0 = int(hexs[0:64], 16) / 1e18
    r1 = int(hexs[64:128], 16) / 1e18
    t0res = _eth_call(pair, SEL_TOKEN0)
    t0 = '0x' + t0res[-40:]
    if t0.lower() == TOKEN.lower():
        ttn_res, usdt_res = r0, r1
    else:
        usdt_res, ttn_res = r0, r1
    if ttn_res <= 0 or usdt_res <= 0:
        return {"live": False, "pair_address": pair}
    price = usdt_res / ttn_res
    return {
        "live": True,
        "price_usd": round(price, 8),
        "usdt": round(usdt_res, 4),
        "ttn": round(ttn_res, 4),
        "value_usd": round(usdt_res * 2, 2),
        "pair": "TTN/USDT · PancakeSwap V2",
        "pair_address": pair,
    }


def get_pool_state():
    now = time.time()
    if _cache["data"] is not None and (now - _cache["ts"]) < _TTL:
        return _cache["data"]
    try:
        data = _read_pool()
    except Exception as e:
        data = {"live": False, "error": str(e)[:120]}
    _cache["ts"] = now
    _cache["data"] = data
    return data
