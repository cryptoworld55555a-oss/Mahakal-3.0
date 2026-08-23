"""TITAN (TTN) Module 1 backend tests: health, config, SIWE auth, user, dashboard stats."""
import os
from datetime import datetime, timedelta, timezone

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
        # seeded baselines (activation tests only increase these)
        assert d["creator_balance_usdt"] >= 12500.0
        assert d["pools"]["daily_usdt"] >= 3200.0
        assert d["pools"]["weekly_usdt"] >= 8750.0
        assert d["pools"]["monthly_usdt"] >= 21400.0
        assert d["community_fund_usdt"] >= 45000.0
        assert float(d["total_supply_ttn"]) == 200000.0
        assert isinstance(d["total_users"], int)
        assert isinstance(d["total_activated_users"], int)

    # Module 2: min_activation + reset timestamps
    def test_stats_includes_min_activation_and_resets(self, client):
        d = client.get(f"{API}/dashboard/stats", timeout=30).json()
        assert d["min_activation_usdt"] == 10
        resets = d["resets"]
        now = datetime.now(timezone.utc)
        daily = datetime.fromisoformat(resets["daily"])
        weekly = datetime.fromisoformat(resets["weekly"])
        monthly = datetime.fromisoformat(resets["monthly"])
        for label, ts in [("daily", daily), ("weekly", weekly), ("monthly", monthly)]:
            assert ts.tzinfo is not None, f"{label} reset missing tz"
            assert ts > now, f"{label} reset in the past: {ts}"
            assert (ts.hour, ts.minute, ts.second) == (0, 0, 0), f"{label} not midnight"
        # next UTC midnight
        assert daily.date() == (now + timedelta(days=1)).date()
        # next Monday
        assert weekly.weekday() == 0, f"weekly reset not Monday: {weekly}"
        assert 0 < (weekly - now).days + 1 <= 7
        # first of next month
        assert monthly.day == 1
        assert (monthly.year, monthly.month) == ((now.year + 1, 1) if now.month == 12 else (now.year, now.month + 1))

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


# ---------------- Module 2: Activation (POST /api/activate) ----------------
def authed_wallet(client):
    """Create a real SIWE-authenticated user and return its lowercase address."""
    acct, addr = new_wallet()
    nonce = client.get(f"{API}/auth/nonce", params={"address": addr}, timeout=30).json()["nonce"]
    msg = siwe_message(addr, nonce)
    r = client.post(f"{API}/auth/verify", json={"address": addr, "signature": sign(acct, msg), "message": msg}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["is_active"] is False
    return addr


class TestActivation:
    def test_below_minimum_rejected(self, client):
        addr = authed_wallet(client)
        r = client.post(f"{API}/activate", json={"address": addr, "amount": 5}, timeout=30)
        assert r.status_code == 400, r.text
        assert r.json()["detail"] == "Minimum activation is $10 USDT"
        # still inactive
        assert client.get(f"{API}/user/{addr}", timeout=30).json()["is_active"] is False

    def test_unknown_address_404(self, client):
        _, addr = new_wallet()
        r = client.post(f"{API}/activate", json={"address": addr, "amount": 50}, timeout=30)
        assert r.status_code == 404, r.text
        assert r.json()["detail"] == "Connect your wallet first"

    def test_activate_success_updates_user_and_stats(self, client):
        addr = authed_wallet(client)
        before = client.get(f"{API}/dashboard/stats", timeout=30).json()
        amount = 100.0

        r = client.post(f"{API}/activate", json={"address": addr, "amount": amount}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["address"] == addr
        assert d["is_active"] is True
        assert d["activated_at"] is not None
        assert float(d["total_deposited"]) == amount
        assert "_id" not in d

        # persisted
        g = client.get(f"{API}/user/{addr}", timeout=30).json()
        assert g["is_active"] is True
        assert float(g["total_deposited"]) == amount

        after = client.get(f"{API}/dashboard/stats", timeout=30).json()
        assert after["total_activated_users"] >= before["total_activated_users"] + 1
        assert round(after["creator_balance_usdt"] - before["creator_balance_usdt"], 2) >= round(amount * 0.20, 2)
        for key in ["daily_usdt", "weekly_usdt", "monthly_usdt"]:
            assert round(after["pools"][key] - before["pools"][key], 2) >= round(amount * 0.15, 2)
        assert round(after["community_fund_usdt"] - before["community_fund_usdt"], 2) >= round(amount * 0.15, 2)

    def test_exact_minimum_accepted(self, client):
        addr = authed_wallet(client)
        r = client.post(f"{API}/activate", json={"address": addr, "amount": 10}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["is_active"] is True
        assert float(r.json()["total_deposited"]) == 10.0

    def test_no_upper_cap(self, client):
        addr = authed_wallet(client)
        r = client.post(f"{API}/activate", json={"address": addr, "amount": 1000000}, timeout=30)
        assert r.status_code == 200, r.text
        assert float(r.json()["total_deposited"]) == 1000000.0

    def test_repeat_activation_is_idempotent(self, client):
        """Server design (server.py): an already-Active ID is NOT re-charged in demo mode."""
        addr = authed_wallet(client)
        first = client.post(f"{API}/activate", json={"address": addr, "amount": 10}, timeout=30).json()
        second = client.post(f"{API}/activate", json={"address": addr, "amount": 25}, timeout=30)
        assert second.status_code == 200, second.text
        d = second.json()
        assert float(d["total_deposited"]) == 10.0
        assert d["activated_at"] == first["activated_at"]

    def test_activate_checksummed_address(self, client):
        acct, addr = new_wallet()
        nonce = client.get(f"{API}/auth/nonce", params={"address": addr}, timeout=30).json()["nonce"]
        msg = siwe_message(addr, nonce)
        assert client.post(f"{API}/auth/verify", json={"address": addr, "signature": sign(acct, msg), "message": msg}, timeout=30).status_code == 200
        r = client.post(f"{API}/activate", json={"address": acct.address, "amount": 10}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["address"] == addr

    def test_activate_missing_fields_422(self, client):
        r = client.post(f"{API}/activate", json={"address": "0x1"}, timeout=30)
        assert r.status_code == 422, r.text

    def test_activate_non_numeric_amount_422(self, client):
        addr = authed_wallet(client)
        r = client.post(f"{API}/activate", json={"address": addr, "amount": "abc"}, timeout=30)
        assert r.status_code == 422, r.text

    def test_negative_amount_rejected(self, client):
        addr = authed_wallet(client)
        r = client.post(f"{API}/activate", json={"address": addr, "amount": -100}, timeout=30)
        assert r.status_code in (400, 422), r.text  # Pydantic gt=0 -> 422
        assert client.get(f"{API}/user/{addr}", timeout=30).json()["is_active"] is False


# ---------------- Module 3: dashboard price + pool_meta ----------------
class TestStatsPriceAndPoolMeta:
    def test_price_fields(self, client):
        d = client.get(f"{API}/dashboard/stats", timeout=30).json()
        assert d["price_usd"] == 10.0, d["price_usd"]
        spark = d["price_spark"]
        assert isinstance(spark, list) and len(spark) == 12, spark
        assert all(isinstance(v, (int, float)) for v in spark)

    def test_pool_meta_shape_and_math(self, client):
        d = client.get(f"{API}/dashboard/stats", timeout=30).json()
        meta = d["pool_meta"]
        for k, pool_key in [("daily", "daily_usdt"), ("weekly", "weekly_usdt"), ("monthly", "monthly_usdt")]:
            m = meta[k]
            assert isinstance(m["qualified_ids"], int) and m["qualified_ids"] >= 1, m
            expected = round(d["pools"][pool_key] / m["qualified_ids"], 2)
            assert abs(m["sharing_usdt"] - expected) < 0.02, (k, m, expected)


# ---------------- Module 3: GET /api/me/{address} ----------------
class TestMe:
    def test_me_unknown_404(self, client):
        _, addr = new_wallet()
        r = client.get(f"{API}/me/{addr}", timeout=30)
        assert r.status_code == 404, r.text

    def test_me_inactive_shape(self, client):
        addr = authed_wallet(client)
        r = client.get(f"{API}/me/{addr}", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "_id" not in d
        assert d["uid"].startswith("TTN")
        assert d["status"] == "Inactive" and d["is_active"] is False
        assert d["referral_code"] == d["uid"]
        assert d["stake_usdt"] == 0.0
        mining = d["mining"]
        for k in ["available_cap_usdt", "generated_reward_usdt", "requires_usdt"]:
            assert k in mining, mining
        holding = d["holding"]
        for k in ["ttn", "mined_value_usdt", "current_value_usdt", "appreciation_usdt"]:
            assert k in holding, holding
        assert d["total_profit_usdt"] == 0.0
        ps = d["profit_sources"]
        assert len(ps) == 5
        assert [p["label"] for p in ps] == ["ROI", "Daily", "Weekly", "Level", "Monthly"]
        for p in ps:
            assert p["color"].startswith("#") and isinstance(p["value"], (int, float))
        assert set(d["team"]) == {"direct_reward_usdt", "level_reward_usdt"}
        acts = d["recent_activity"]
        assert len(acts) == 1 and acts[0]["label"] == "Registration"
        assert acts[0]["hash"].startswith("0x") and acts[0]["amount"] == "-"
        assert len(acts[0]["date"]) == 10

    def test_me_active_prepends_activation(self, client):
        addr = authed_wallet(client)
        assert client.post(f"{API}/activate", json={"address": addr, "amount": 25}, timeout=30).status_code == 200
        d = client.get(f"{API}/me/{addr}", timeout=30).json()
        assert d["status"] == "Active" and d["is_active"] is True
        acts = d["recent_activity"]
        assert len(acts) == 2, acts
        assert acts[0]["label"] == "Activation"
        assert acts[0]["amount"] in ("$25.0", "$25", "$25.00"), acts[0]["amount"]
        assert acts[1]["label"] == "Registration"

    def test_me_checksummed_address(self, client):
        acct, addr = new_wallet()
        nonce = client.get(f"{API}/auth/nonce", params={"address": addr}, timeout=30).json()["nonce"]
        msg = siwe_message(addr, nonce)
        assert client.post(f"{API}/auth/verify", json={"address": addr, "signature": sign(acct, msg), "message": msg}, timeout=30).status_code == 200
        r = client.get(f"{API}/me/{acct.address}", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["address"] == addr

    def test_me_hash_deterministic(self, client):
        addr = authed_wallet(client)
        h1 = client.get(f"{API}/me/{addr}", timeout=30).json()["recent_activity"][0]["hash"]
        h2 = client.get(f"{API}/me/{addr}", timeout=30).json()["recent_activity"][0]["hash"]
        assert h1 == h2


# ---------------- Module 3: GET /api/holders ----------------
class TestHolders:
    def test_default_page(self, client):
        r = client.get(f"{API}/holders", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total"] == 200
        assert d["page"] == 1
        assert d["page_size"] == 25
        assert d["pages"] == 8
        hs = d["holders"]
        assert len(hs) == 25
        assert [h["rank"] for h in hs] == list(range(1, 26))
        ttns = [h["ttn"] for h in hs]
        assert ttns == sorted(ttns, reverse=True), ttns
        for h in hs:
            assert h["address"].startswith("0x")

    def test_pagination_next_page_ranks(self, client):
        d = client.get(f"{API}/holders", params={"page": 2}, timeout=30).json()
        assert d["page"] == 2
        assert d["holders"][0]["rank"] == 26
        assert len(d["holders"]) == 25

    def test_page_clamping(self, client):
        hi = client.get(f"{API}/holders", params={"page": 999}, timeout=30).json()
        assert hi["page"] == hi["pages"] == 8
        assert hi["holders"][0]["rank"] == 176
        lo = client.get(f"{API}/holders", params={"page": 0}, timeout=30).json()
        assert lo["page"] == 1
        neg = client.get(f"{API}/holders", params={"page": -5}, timeout=30).json()
        assert neg["page"] == 1

    def test_page_size_custom(self, client):
        d = client.get(f"{API}/holders", params={"page_size": 10}, timeout=30).json()
        assert d["page_size"] == 10 and len(d["holders"]) == 10 and d["pages"] == 20

    def test_search_filters(self, client):
        first = client.get(f"{API}/holders", timeout=30).json()["holders"][0]["address"]
        frag = first[2:6]
        d = client.get(f"{API}/holders", params={"search": frag}, timeout=30).json()
        assert d["total"] >= 1 and d["total"] < 200
        assert all(frag.lower() in h["address"].lower() for h in d["holders"])

    def test_search_no_match(self, client):
        d = client.get(f"{API}/holders", params={"search": "zzzzzzzz"}, timeout=30).json()
        assert d["total"] == 0 and d["pages"] == 1 and d["holders"] == []

    def test_holders_stable_across_calls(self, client):
        a = client.get(f"{API}/holders", timeout=30).json()["holders"]
        b = client.get(f"{API}/holders", timeout=30).json()["holders"]
        assert a == b
