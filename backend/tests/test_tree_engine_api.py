"""TITAN Referral Tree Engine API tests.

Covers: POST /api/reward/tree/seed-demo, POST /api/reward/tree/build,
GET /api/reward/tree/user/{address}, OZ Merkle proof verification, and
referral (ref) capture via /api/auth/nonce + /api/auth/verify.

All tests live in a single class on purpose: pytest.ini runs -n 2 --dist loadscope,
so one class == one worker == sequential shared DB state (tree build determinism
would race otherwise).
"""
import os
import re
import sys
import time

import pytest
import requests
from dotenv import dotenv_values
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak, to_checksum_address
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
import merkle  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing from env and /app/frontend/.env")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

backend_env = dotenv_values("/app/backend/.env")
MONGO_URL = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")

ROOT_ADDR = "0xde00000000000000000000000000000000000000"
A_ADDR = "0xde00000000000000000000000000000000000001"
HEX_ROOT = re.compile(r"^0x[0-9a-f]{64}$")


# ----------------------------- fixtures -----------------------------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo():
    if not MONGO_URL or not DB_NAME:
        pytest.skip("MONGO_URL/DB_NAME not configured")
    c = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    yield c[DB_NAME]
    c.close()


@pytest.fixture(scope="module")
def created_addresses():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(mongo, created_addresses):
    yield
    for a in created_addresses:
        mongo.users.delete_many({"address": a.lower()})
        mongo.nonces.delete_many({"_id": a.lower()})


# ----------------------------- helpers -----------------------------
def _oz_verify(leaf: bytes, proof_hexes, root_hex: str) -> bool:
    computed = leaf
    for p in proof_hexes:
        sib = bytes.fromhex(p[2:])
        lo, hi = (computed, sib) if computed <= sib else (sib, computed)
        computed = keccak(lo + hi)
    return "0x" + computed.hex() == root_hex


def _auth_new_wallet(api, ref=None, address_override=None, message_override=None):
    """Full SIWE flow with a freshly generated wallet. Returns (address, response)."""
    acct = Account.create()
    addr = acct.address
    n = api.get(f"{API}/auth/nonce", params={"address": addr})
    assert n.status_code == 200, f"nonce failed: {n.status_code} {n.text[:300]}"
    nonce = n.json()["nonce"]
    chain_id = n.json()["chain_id"]
    message = message_override or (
        f"TITAN Sign-In\nAddress: {addr}\nChain ID: {chain_id}\nNonce: {nonce}"
    )
    sig = Account.sign_message(encode_defunct(text=message), private_key=acct.key)
    payload = {
        "address": address_override or addr,
        "message": message,
        "signature": sig.signature.hex() if not isinstance(sig.signature, str) else sig.signature,
        "nonce": nonce,
    }
    if ref is not None:
        payload["ref"] = ref
    r = api.post(f"{API}/auth/verify", json=payload)
    return addr, r


class TestReferralTreeEngine:
    """Tree engine end-to-end: seed -> build -> per-user breakdown -> proof verification."""

    # --- health / preconditions ---
    def test_00_health(self, api):
        r = api.get(f"{API}/health")
        assert r.status_code == 200, r.text[:300]
        assert r.json()["ok"] is True

    # --- POST /api/reward/tree/seed-demo ---
    def test_01_seed_demo(self, api, mongo):
        r = api.post(f"{API}/reward/tree/seed-demo")
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        data = r.json()
        assert data["seeded"] == 8, data
        addrs = data["addresses"]
        assert addrs["DEMO_ROOT"] == ROOT_ADDR
        assert addrs["DEMO_A"] == A_ADDR
        assert len(addrs) == 8
        # persistence: exactly 8 DEMO_* users, sponsor edges intact
        assert mongo.users.count_documents({"uid": {"$regex": "^DEMO"}}) == 8
        a_doc = mongo.users.find_one({"uid": "DEMO_A"})
        assert a_doc["sponsor"] == ROOT_ADDR
        assert a_doc["total_deposited"] == 500
        a3 = mongo.users.find_one({"uid": "DEMO_A3"})
        assert a3["is_active"] is False and a3["activated_at"] is None

    def test_02_seed_demo_idempotent(self, api, mongo):
        r = api.post(f"{API}/reward/tree/seed-demo")
        assert r.status_code == 200
        assert r.json()["seeded"] == 8
        assert mongo.users.count_documents({"uid": {"$regex": "^DEMO"}}) == 8

    # --- POST /api/reward/tree/build ---
    def test_03_build_returns_root_and_proofs(self, api):
        r = api.post(f"{API}/reward/tree/build")
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        d = r.json()
        assert HEX_ROOT.match(d["root"]), d["root"]
        assert d["leaf_count"] > 0
        assert d["user_count"] > 0
        assert isinstance(d["proofs"], list) and len(d["proofs"]) == d["leaf_count"]
        assert "_id" not in d
        p = d["proofs"][0]
        for k in ("address", "amount_wei", "capReduce", "proof"):
            assert k in p, p
        assert isinstance(p["amount_wei"], str)
        # pools computed and non-negative
        for k in ("daily", "weekly", "monthly"):
            assert d["pools"][k] >= 0

    def test_04_build_is_deterministic(self, api):
        r1 = api.post(f"{API}/reward/tree/build")
        r2 = api.post(f"{API}/reward/tree/build")
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["root"] == r2.json()["root"], "root not deterministic on unchanged data"
        assert r1.json()["leaf_count"] == r2.json()["leaf_count"]

    def test_05_latest_root_matches_build(self, api):
        b = api.post(f"{API}/reward/tree/build").json()
        latest = api.get(f"{API}/reward/merkle/latest")
        assert latest.status_code == 200
        assert latest.json()["root"] == b["root"]

    # --- GET /api/reward/tree/user/{address} : DEMO_ROOT ---
    def test_06_root_breakdown(self, api):
        r = api.get(f"{API}/reward/tree/user/{ROOT_ADDR}")
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        d = r.json()
        bd = d["breakdown"]
        assert HEX_ROOT.match(d["root"])
        assert bd["address"] == ROOT_ADDR
        assert bd["mining_cap_usd"] == 3000, bd            # owner 300% of $1000
        assert bd["level_income_usd"] == 56, bd            # (500+300)*7%
        assert bd["level_lapsed_usd"] == 19.5, bd          # L2/L3 lapse (rank Active -> max_level 1)
        assert bd["self_roi_usd"] == 600, bd               # 40d * 3000 * 0.5%
        assert bd["rank"] == "Active", bd
        assert bd["active_directs"] == 2, bd
        assert bd["direct_business_usd"] == 800, bd
        assert bd["cumulative_reducing_usd"] <= bd["mining_cap_usd"]
        assert bd["daily_pool_usd"] >= 0 and bd["weekly_pool_usd"] >= 0 and bd["monthly_pool_usd"] >= 0
        assert bd["cumulative_nonreducing_usd"] == pytest.approx(
            bd["self_roi_usd"] + bd["daily_pool_usd"] + bd["weekly_pool_usd"], rel=1e-9)
        assert len(d["proofs"]) >= 1

    # --- GET /api/reward/tree/user/{address} : DEMO_A ---
    def test_07_a_breakdown(self, api):
        r = api.get(f"{API}/reward/tree/user/{A_ADDR}")
        assert r.status_code == 200, r.text[:300]
        bd = r.json()["breakdown"]
        assert bd["level_income_usd"] == 28, bd     # (200+100+100)*7%
        assert bd["self_roi_usd"] == 150, bd        # 30d * 1000 * 0.5%
        assert bd["mining_cap_usd"] == 1000, bd     # standard 200% of $500
        assert bd["level_lapsed_usd"] == 3, bd      # A1X at L2
        assert bd["active_directs"] == 2, bd        # A3 inactive
        assert bd["direct_business_usd"] == 400, bd

    def test_08_inactive_user_gets_no_level_income(self, api, mongo):
        a3 = mongo.users.find_one({"uid": "DEMO_A3"})
        r = api.get(f"{API}/reward/tree/user/{a3['address']}")
        assert r.status_code == 200, r.text[:300]
        bd = r.json()["breakdown"]
        assert bd["self_roi_usd"] == 0, bd
        assert bd["daily_pool_usd"] == 0, bd
        assert bd["mining_cap_usd"] == 200, bd

    def test_09_unknown_address_404(self, api):
        r = api.get(f"{API}/reward/tree/user/0x00000000000000000000000000000000000000ff")
        assert r.status_code == 404, f"{r.status_code} {r.text[:300]}"
        assert "detail" in r.json()

    def test_10_case_insensitive_lookup(self, api):
        r = api.get(f"{API}/reward/tree/user/{to_checksum_address(ROOT_ADDR)}")
        assert r.status_code == 200, r.text[:300]
        assert r.json()["breakdown"]["level_income_usd"] == 56

    # --- OZ proof verification ---
    def test_11_all_proofs_verify_against_root(self, api):
        d = api.post(f"{API}/reward/tree/build").json()
        root = d["root"]
        bad = []
        for p in d["proofs"]:
            leaf = merkle.leaf_hash(p["address"], int(p["amount_wei"]), p["capReduce"])
            if not _oz_verify(leaf, p["proof"], root):
                bad.append(p["address"])
        assert not bad, f"{len(bad)}/{len(d['proofs'])} proofs failed verification: {bad[:5]}"
        assert len(d["proofs"]) > 1

    def test_12_tampered_proof_fails(self, api):
        d = api.post(f"{API}/reward/tree/build").json()
        p = d["proofs"][0]
        leaf = merkle.leaf_hash(p["address"], int(p["amount_wei"]) + 1, p["capReduce"])
        assert not _oz_verify(leaf, p["proof"], d["root"]), "tampered amount still verified"

    def test_13_user_proof_matches_snapshot_root(self, api):
        api.post(f"{API}/reward/tree/build")
        r = api.get(f"{API}/reward/tree/user/{ROOT_ADDR}")
        d = r.json()
        for p in d["proofs"]:
            leaf = merkle.leaf_hash(p["address"], int(p["amount_wei"]), p["capReduce"])
            assert _oz_verify(leaf, p["proof"], d["root"]), p["address"]

    # --- Referral capture via SIWE auth ---
    def test_14_ref_by_uid_stored(self, api, mongo, created_addresses):
        sponsor = mongo.users.find_one({"uid": "DEMO_ROOT"})
        # resolve by a real TTN uid if one exists, else by DEMO uid (same code path)
        ttn = mongo.users.find_one({"uid": {"$regex": "^TTN1"}})
        ref_uid = ttn["uid"] if ttn else sponsor["uid"]
        expected = (ttn or sponsor)["address"].lower()
        addr, r = _auth_new_wallet(api, ref=ref_uid)
        created_addresses.append(addr)
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        assert r.json()["uid"].startswith("TTN"), r.json()
        doc = mongo.users.find_one({"address": addr.lower()})
        assert doc is not None, "user not persisted"
        assert doc.get("sponsor") == expected, f"sponsor={doc.get('sponsor')} expected={expected}"

    def test_15_ref_by_address_stored(self, api, mongo, created_addresses):
        addr, r = _auth_new_wallet(api, ref=ROOT_ADDR)
        created_addresses.append(addr)
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        doc = mongo.users.find_one({"address": addr.lower()})
        assert doc.get("sponsor") == ROOT_ADDR, doc.get("sponsor")

    def test_16_self_referral_rejected(self, api, mongo, created_addresses):
        acct = Account.create()
        addr = acct.address
        created_addresses.append(addr)
        # first sign-in creates the user (no ref)
        n = api.get(f"{API}/auth/nonce", params={"address": addr}).json()
        msg = f"TITAN Sign-In\nAddress: {addr}\nChain ID: {n['chain_id']}\nNonce: {n['nonce']}"
        sig = Account.sign_message(encode_defunct(text=msg), private_key=acct.key)
        r1 = api.post(f"{API}/auth/verify", json={
            "address": addr, "message": msg,
            "signature": sig.signature.hex(), "nonce": n["nonce"]})
        assert r1.status_code == 200, r1.text[:300]
        # now the user exists; force re-creation path to test self-ref guard
        mongo.users.delete_one({"address": addr.lower()})
        mongo.users.insert_one({
            "id": "selfref-probe", "address": addr.lower(), "uid": "DEMO_SELFREF",
            "sponsor": None, "total_deposited": 0, "is_active": False,
            "owner_tier": False, "activated_at": None,
        })
        import asyncio
        import server
        # direct unit check of the guard (the HTTP path cannot re-create an existing user).
        # Both awaits must share ONE event loop: motor's client binds to the first loop it sees.
        async def _probe():
            return (await server._resolve_sponsor(addr, addr),
                    await server._resolve_sponsor(addr, ROOT_ADDR))

        resolved_self, resolved_other = asyncio.run(_probe())
        assert resolved_self is None, f"self-referral accepted: {resolved_self}"
        assert resolved_other == addr.lower(), resolved_other
        mongo.users.delete_one({"address": addr.lower()})

    def test_17_unknown_ref_leaves_sponsor_null(self, api, mongo, created_addresses):
        addr, r = _auth_new_wallet(api, ref="TTN999999")
        created_addresses.append(addr)
        assert r.status_code == 200, r.text[:400]
        doc = mongo.users.find_one({"address": addr.lower()})
        assert doc.get("sponsor") is None, doc.get("sponsor")

    def test_18_bad_signature_rejected(self, api):
        acct = Account.create()
        other = Account.create()
        n = api.get(f"{API}/auth/nonce", params={"address": acct.address}).json()
        msg = f"TITAN Sign-In\nAddress: {acct.address}\nChain ID: {n['chain_id']}\nNonce: {n['nonce']}"
        sig = Account.sign_message(encode_defunct(text=msg), private_key=other.key)
        r = api.post(f"{API}/auth/verify", json={
            "address": acct.address, "message": msg,
            "signature": sig.signature.hex(), "nonce": n["nonce"]})
        assert r.status_code == 401, f"{r.status_code} {r.text[:300]}"

    # --- new sponsored user shows up in the tree ---
    def test_19_new_referral_appears_in_tree(self, api, mongo, created_addresses):
        before = api.post(f"{API}/reward/tree/build").json()
        addr, r = _auth_new_wallet(api, ref=ROOT_ADDR)
        created_addresses.append(addr)
        assert r.status_code == 200, r.text[:300]
        after = api.post(f"{API}/reward/tree/build").json()
        assert after["user_count"] == before["user_count"] + 1
        # zero-stake inactive user -> no leaves, so root should be unchanged
        tr = api.get(f"{API}/reward/tree/user/{addr.lower()}")
        assert tr.status_code == 200, tr.text[:300]
        bd = tr.json()["breakdown"]
        assert bd["mining_cap_usd"] == 0 and bd["cumulative_reducing_usd"] == 0
        # ROOT's direct business unchanged (new user has 0 stake)
        rb = api.get(f"{API}/reward/tree/user/{ROOT_ADDR}").json()["breakdown"]
        assert rb["direct_business_usd"] == 800, rb
        assert rb["level_income_usd"] == 56, rb
