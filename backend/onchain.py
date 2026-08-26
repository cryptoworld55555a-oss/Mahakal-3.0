"""Reads the REAL PancakeSwap V2 TTN/USDT pool state from BSC mainnet via raw JSON-RPC.
No web3 dependency (avoids version conflicts). Returns live price + liquidity, or
{"live": False} before the pool is seeded. Cached briefly to avoid RPC spam."""
import os
import time
import json
import urllib.request

FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'                 # PancakeSwap V2 factory (BSC)
USDT = '0x55d398326f99059fF775485246999027B3197955'                    # BSC-USD


def _rpc_url():
    return os.environ.get('BSC_RPC_URL', 'https://bsc-dataseed.binance.org')


def _token_address():
    return os.environ.get('TOKEN_ADDRESS', '0x0000000000000000000000000000000000000000')

# Function selectors
SEL_GET_PAIR = '0xe6a43905'      # getPair(address,address)
SEL_GET_RESERVES = '0x0902f1ac'  # getReserves()
SEL_TOKEN0 = '0x0dfe1681'        # token0()
SEL_BALANCE_OF = '0x70a08231'    # balanceOf(address)

_cache = {"ts": 0, "data": None}
_TTL = 30  # seconds


def _addr32(a: str) -> str:
    return a.lower().replace('0x', '').rjust(64, '0')


def _eth_call(to: str, data: str):
    payload = json.dumps({
        "jsonrpc": "2.0", "id": 1, "method": "eth_call",
        "params": [{"to": to, "data": data}, "latest"],
    }).encode()
    req = urllib.request.Request(_rpc_url(), data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=8) as r:
        res = json.loads(r.read().decode())
    return res.get("result", "0x")


def _rpc(method: str, params: list):
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(_rpc_url(), data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        res = json.loads(r.read().decode())
    if res.get("error"):
        raise RuntimeError(res["error"].get("message", str(res["error"])))
    return res.get("result")


SEL_SET_MERKLE_ROOT = '0x7cb64759'  # setMerkleRoot(bytes32)


def _poster_account():
    """Load the ROOT POSTER account from BSC_ROOT_POSTER_PK. Accepts EITHER a raw private key
    (hex, with/without 0x) OR a 12/24-word seed phrase (mnemonic). Returns an eth_account
    Account, or None if not configured."""
    from eth_account import Account
    val = os.environ.get('BSC_ROOT_POSTER_PK', '').strip()
    if not val:
        return None
    try:
        if len(val.split()) >= 12:  # looks like a seed phrase
            Account.enable_unaudited_hdwallet_features()
            return Account.from_mnemonic(val)
        if not val.startswith('0x'):
            val = '0x' + val
        return Account.from_key(val)
    except Exception:
        return None


def set_merkle_root_onchain(root_hex: str):
    """Sign & send setMerkleRoot(root) from the backend ROOT POSTER hot wallet (limited role:
    can ONLY set the Merkle root, CANNOT move funds). Returns the tx hash, or None if no key set.
    Raises on RPC/signing errors so the caller can log them."""
    from eth_account import Account
    acct = _poster_account()
    if acct is None:
        return None
    proto = os.environ.get('MAIN_PROTOCOL_ADDRESS', '')
    if not proto or proto.lower() == '0x0000000000000000000000000000000000000000':
        raise RuntimeError("MAIN_PROTOCOL_ADDRESS not set")
    data = SEL_SET_MERKLE_ROOT + root_hex[2:].rjust(64, '0')
    nonce = int(_rpc('eth_getTransactionCount', [acct.address, 'pending']), 16)
    gas_price = int(_rpc('eth_gasPrice', []), 16)
    tx = {
        'nonce': nonce,
        'to': proto,
        'value': 0,
        'gas': 120000,
        'gasPrice': gas_price,
        'data': data,
        'chainId': int(os.environ.get('CHAIN_ID', '56')),
    }
    signed = Account.sign_transaction(tx, acct.key)
    txhash = _rpc('eth_sendRawTransaction', ['0x' + signed.raw_transaction.hex()])
    return txhash


def root_poster_address():
    """The address of the configured backend root-poster hot wallet (or None)."""
    acct = _poster_account()
    return acct.address if acct else None


SEL_ROOT_POSTER = '0x3a7ad71e'  # rootPoster()


def get_root_poster_onchain() -> str:
    """The address currently authorized as rootPoster on the contract (or zero addr)."""
    proto = os.environ.get('MAIN_PROTOCOL_ADDRESS', '0x0000000000000000000000000000000000000000')
    zero = '0x' + '0' * 40
    if proto.lower() == '0x0000000000000000000000000000000000000000':
        return zero
    try:
        raw = _eth_call(proto, SEL_ROOT_POSTER)
        if not raw or raw == '0x':
            return zero
        return '0x' + raw[-40:]
    except Exception:
        return zero


def balance_of(wallet: str) -> float:
    """Real on-chain TTN balance of a wallet (18 decimals). Returns 0.0 on any error."""
    token = _token_address()
    if token.lower() == '0x0000000000000000000000000000000000000000':
        return 0.0
    try:
        raw = _eth_call(token, SEL_BALANCE_OF + _addr32(wallet))
        return int(raw, 16) / 1e18 if raw and raw != '0x' else 0.0
    except Exception:
        return 0.0


SEL_MERKLE_ROOT = '0x2eb4a7ab'  # merkleRoot()


def get_merkle_root() -> str:
    """Read the merkleRoot currently posted on the TitanProtocol contract (bytes32 hex).
    Returns the zero hash if unset or on error."""
    proto = os.environ.get('MAIN_PROTOCOL_ADDRESS', '0x0000000000000000000000000000000000000000')
    zero = '0x' + '0' * 64
    if proto.lower() == '0x0000000000000000000000000000000000000000':
        return zero
    try:
        raw = _eth_call(proto, SEL_MERKLE_ROOT)
        if not raw or raw == '0x':
            return zero
        return '0x' + raw[2:].rjust(64, '0')[-64:]
    except Exception:
        return zero


def _read_pool():
    TOKEN = _token_address()
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
