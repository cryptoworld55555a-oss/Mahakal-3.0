"""TITAN (TTN) Module 1 backend tests: health, config, SIWE auth, user, dashboard stats."""
import os
from datetime import datetime, timezone

import pytest
import requests
from dotenv import dotenv_values
from eth_account import Account
from eth_account.messages import encode_defunct

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"
CHAIN_ID = 97
ZERO = "0x0000000000000000000000000000000000000000"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def siwe_message(address, nonce, chain_id=CHAIN_ID):
    return (
        f"test.host wants you to sign in with your Ethereum account:\n"
        f"{address}\n\n"
        f"Sign in to TITAN (TTN).\n\n"
        f"URI: https://test.host\n"
        f"Version: 1\n"
        f"Chain ID: {chain_id}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {datetime.now(timezone.utc).isoformat()}"
    )


def new_wallet():
    acct = Account.create()
    return acct, acct.address.lower()


def sign(acct, message):
    return Account.sign_message(encode_defunct(text=message), acct.key).signature.hex()


# ---------------- Health / Config ----------------
class TestHealthConfig:
    def test_health(self, client):
        r = client.get(f"{API}/health", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["chain_id"] == CHAIN_ID

    def test_config(self, client):
        r = client.get(f"{API}/config", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["chain_id"] == CHAIN_ID
        t = d["token"]
        assert t["name"] == "Titan" and t["symbol"] == "TTN"
        assert t["decimals"] == 18
        assert float(t["total_supply"]) == 200000.0
        c = d["contracts"]
        for key in ["token", "main_protocol", "reward_engine", "pool_manager", "community_fund"]:
            assert key in c, f"missing contract key {key}"
            assert c[key] == ZERO


# ---------------- Dashboard stats ----------------
class TestDashboardStats:
    def test_stats_shape_and_values(self, client):
        r = client.get(f"{API}/dashboard/stats", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["creator_balance_usdt"] == 12500.0
        assert d["pools"]["daily_usdt"] == 3200.0
        assert d["pools"]["weekly_usdt"] == 8750.0
        assert d["pools"]["monthly_usdt"] == 21400.0
        assert d["community_fund_usdt"] == 45000.0
        assert float(d["total_supply_ttn"]) == 200000.0
        assert isinstance(d["total_users"], int)
        assert d["total_activated_users"] == 0

    def test_total_users_increments_on_new_wallet(self, client):
        before = client.get(f"{API}/dashboard/stats", timeout=30).json()["total_users"]
        acct, addr = new_wallet()
        nonce = client.get(f"{API}/auth/nonce", params={"address": addr}, timeout=30).json()["nonce"]
        msg = siwe_message(addr, nonce)
        r = client.post(f"{API}/auth/verify", json={"address": addr, "signature": sign(acct, msg), "message": msg}, timeout=30)
        assert r.status_code == 200, r.text
        after = client.get(f"{API}/dashboard/stats", timeout=30).json()
        # >= because other tests may create wallets concurrently (pytest-xdist)
        assert after["total_users"] >= before + 1
        assert after["total_activated_users"] == 0


# ---------------- SIWE auth ----------------
class TestSiweAuth:
    def test_nonce(self, client):
        _, addr = new_wallet()
        r = client.get(f"{API}/auth/nonce", params={"address": addr}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["nonce"], str) and len(d["nonce"]) > 10
        assert d["chain_id"] == CHAIN_ID

    def test_verify_creates_user_with_uid(self, client):
        acct, addr = new_wallet()
        # 404 before auth
        pre = client.get(f"{API}/user/{addr}", timeout=30)
        assert pre.status_code == 404, pre.text

        nonce = client.get(f"{API}/auth/nonce", params={"address": addr}, timeout=30).json()["nonce"]
        msg = siwe_message(addr, nonce)
        r = client.post(f"{API}/auth/verify", json={"address": addr, "signature": sign(acct, msg), "message": msg}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["address"] == addr
        assert d["uid"].startswith("TTN") and len(d["uid"]) == 9 and int(d["uid"][3:]) >= 100001
        assert d["is_active"] is False
        assert "_id" not in d

        # persisted
        g = client.get(f"{API}/user/{addr}", timeout=30)
        assert g.status_code == 200, g.text
        assert g.json()["uid"] == d["uid"]
        assert g.json()["is_active"] is False
        assert "_id" not in g.json()

    def test_repeat_login_keeps_same_uid(self, client):
        acct, addr = new_wallet()
        uids = []
        for _ in range(2):
            nonce = client.get(f"{API}/auth/nonce", params={"address": addr}, timeout=30).json()["nonce"]
            msg = siwe_message(addr, nonce)
            r = client.post(f"{API}/auth/verify", json={"address": addr, "signature": sign(acct, msg), "message": msg}, timeout=30)
            assert r.status_code == 200, r.text
            uids.append(r.json()["uid"])
        assert uids[0] == uids[1]

    def test_nonce_one_time_use(self, client):
        acct, addr = new_wallet()
        nonce = client.get(f"{API}/auth/nonce", params={"address": addr}, timeout=30).json()["nonce"]
        msg = siwe_message(addr, nonce)
        sig = sign(acct, msg)
        first = client.post(f"{API}/auth/verify", json={"address": addr, "signature": sig, "message": msg}, timeout=30)
        assert first.status_code == 200, first.text
        second = client.post(f"{API}/auth/verify", json={"address": addr, "signature": sig, "message": msg}, timeout=30)
        assert second.status_code == 401, f"replay accepted: {second.status_code} {second.text}"

    def test_signature_address_mismatch(self, client):
        acct, addr = new_wallet()
        other, other_addr = new_wallet()
        nonce = client.get(f"{API}/auth/nonce", params={"address": addr}, timeout=30).json()["nonce"]
        msg = siwe_message(addr, nonce)
        r = client.post(f"{API}/auth/verify", json={"address": addr, "signature": sign(other, msg), "message": msg}, timeout=30)
        assert r.status_code == 401, r.text
        assert "detail" in r.json()

    def test_wrong_chain_id_rejected(self, client):
        acct, addr = new_wallet()
        nonce = client.get(f"{API}/auth/nonce", params={"address": addr}, timeout=30).json()["nonce"]
        msg = siwe_message(addr, nonce, chain_id=1)
        r = client.post(f"{API}/auth/verify", json={"address": addr, "signature": sign(acct, msg), "message": msg}, timeout=30)
        assert r.status_code == 401, r.text

    def test_missing_nonce_rejected(self, client):
        acct, addr = new_wallet()
        msg = siwe_message(addr, "fabricated-nonce-value")
        r = client.post(f"{API}/auth/verify", json={"address": addr, "signature": sign(acct, msg), "message": msg}, timeout=30)
        assert r.status_code == 401, r.text

    def test_tampered_nonce_rejected(self, client):
        acct, addr = new_wallet()
        client.get(f"{API}/auth/nonce", params={"address": addr}, timeout=30)
        msg = siwe_message(addr, "not-the-real-nonce")
        r = client.post(f"{API}/auth/verify", json={"address": addr, "signature": sign(acct, msg), "message": msg}, timeout=30)
        assert r.status_code == 401, r.text

    def test_garbage_signature_rejected(self, client):
        _, addr = new_wallet()
        nonce = client.get(f"{API}/auth/nonce", params={"address": addr}, timeout=30).json()["nonce"]
        msg = siwe_message(addr, nonce)
        r = client.post(f"{API}/auth/verify", json={"address": addr, "signature": "0xdeadbeef", "message": msg}, timeout=30)
        assert r.status_code == 401, r.text

    def test_verify_missing_fields_422(self, client):
        r = client.post(f"{API}/auth/verify", json={"address": "0x1"}, timeout=30)
        assert r.status_code == 422, r.text

    def test_nonce_requires_address(self, client):
        r = client.get(f"{API}/auth/nonce", timeout=30)
        assert r.status_code == 422, r.text

    def test_case_insensitive_user_lookup(self, client):
        acct, addr = new_wallet()
        nonce = client.get(f"{API}/auth/nonce", params={"address": addr}, timeout=30).json()["nonce"]
        msg = siwe_message(addr, nonce)
        assert client.post(f"{API}/auth/verify", json={"address": addr, "signature": sign(acct, msg), "message": msg}, timeout=30).status_code == 200
        r = client.get(f"{API}/user/{acct.address}", timeout=30)  # checksummed
        assert r.status_code == 200, r.text

    def test_unknown_user_404(self, client):
        _, addr = new_wallet()
        r = client.get(f"{API}/user/{addr}", timeout=30)
        assert r.status_code == 404
