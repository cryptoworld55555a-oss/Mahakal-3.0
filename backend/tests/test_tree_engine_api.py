"""TITAN Referral Tree Engine API tests (binary qualification + one-time Owner-Club).

Covers: POST /api/reward/tree/seed-demo (51-node binary network), POST /api/reward/tree/build,
GET /api/reward/tree/user/{address}, monthly binary qualification, one-time owner_tier(300%)
persistence, 15-level cascade bound, OZ Merkle proof verification, and referral (ref) capture
via /api/auth/nonce + /api/auth/verify.

All tests live in a single class on purpose: pytest.ini runs -n 2 --dist loadscope,
so one class == one worker == sequential shared DB state (tree build determinism
would race otherwise). Test order matters (owner_tier is a one-time DB flag).
"""
import os
import re
import sys

import pytest
import requests
from dotenv import dotenv_values
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak, to_checksum_address
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
import merkle  # noqa: E402
import tree_engine  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing from env and /app/frontend/.env")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

backend_env = dotenv_values("/app/backend/.env")
MONGO_URL = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")

ROOT_ADDR = "0x" + f"{1:040x}"          # DEMO_ROOT
HEX_ROOT = re.compile(r"^0x[0-9a-f]{64}$")

# Seed shape (server.reward_tree_seed_demo): ROOT $1000 40d, 2 legs x 25 nodes @ $350 12d.
# First 8 nodes of EACH leg are ROOT's sponsored directs => 16 directs, $5600 direct business.
LEG_NODES = 25
LEG_STAKE = 350.0
ROOT_STAKE = 1000.0
ROOT_DIRECTS = 16
ROOT_DIRECT_BUSINESS = ROOT_DIRECTS * LEG_STAKE          # 5600
LEG_BUSINESS = LEG_NODES * LEG_STAKE                     # 8750 per binary leg
# ROOT sponsor-tree level distribution (both legs): L1=16, L2=18, L3=16
EXPECTED_ROOT_LEVEL_INCOME = (
    16 * LEG_STAKE * 0.07 + 18 * LEG_STAKE * 0.03 + 16 * LEG_STAKE * 0.03
)  # = 749.0


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


@pytest.fixture(scope="module")
def seed_addrs():
    """Filled by test_01; uid -> address map from the seed response."""
    return {}


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


def _auth_new_wallet(api, ref=None):
    """Full SIWE flow with a freshly generated wallet. Returns (address, response)."""
    acct = Account.create()
    addr = acct.address
    n = api.get(f"{API}/auth/nonce", params={"address": addr})
    assert n.status_code == 200, f"nonce failed: {n.status_code} {n.text[:300]}"
    nonce = n.json()["nonce"]
    chain_id = n.json()["chain_id"]
    message = f"TITAN Sign-In\nAddress: {addr}\nChain ID: {chain_id}\nNonce: {nonce}"
    sig = Account.sign_message(encode_defunct(text=message), private_key=acct.key)
    payload = {
        "address": addr,
        "message": message,
        "signature": sig.signature.hex() if not isinstance(sig.signature, str) else sig.signature,
        "nonce": nonce,
    }
    if ref is not None:
        payload["ref"] = ref
    r = api.post(f"{API}/auth/verify", json=payload)
    return addr, r


def _bd(api, addr):
    r = api.get(f"{API}/reward/tree/user/{addr}")
    assert r.status_code == 200, f"{addr}: {r.status_code} {r.text[:300]}"
    return r.json()


class TestBinaryQualificationAndOwnerClub:
    """seed -> build#1 (standard cap) -> owner_tier persisted -> build#2 (300% cap)."""

    # --- health / preconditions ---
    def test_00_health(self, api):
        r = api.get(f"{API}/health")
        assert r.status_code == 200, r.text[:300]
        assert r.json()["ok"] is True

    # --- POST /api/reward/tree/seed-demo : 51-node binary network ---
    def test_01_seed_demo_binary_network(self, api, mongo, seed_addrs):
        r = api.post(f"{API}/reward/tree/seed-demo")
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        data = r.json()
        assert data["seeded"] == 51, data
        assert data["root_address"] == ROOT_ADDR, data["root_address"]
        addrs = data["addresses"]
        assert len(addrs) == 51, len(addrs)
        seed_addrs.update(addrs)

        # persistence: exactly 51 DEMO_* users
        assert mongo.users.count_documents({"uid": {"$regex": "^DEMO"}}) == 51
        root = mongo.users.find_one({"uid": "DEMO_ROOT"})
        assert root["total_deposited"] == ROOT_STAKE and root["is_active"] is True
        assert root["owner_tier"] is False, "seed must start with owner_tier=False"
        assert root["binary_parent"] is None and root["binary_side"] is None

        # binary placement: L0/R0 hang off ROOT on the correct sides
        l0 = mongo.users.find_one({"uid": "DEMO_L0"})
        r0 = mongo.users.find_one({"uid": "DEMO_R0"})
        assert l0["binary_parent"] == ROOT_ADDR and l0["binary_side"] == "left"
        assert r0["binary_parent"] == ROOT_ADDR and r0["binary_side"] == "right"
        # first 8 of each leg are ROOT's sponsored directs -> 16 directs, $5600
        for uid in ("DEMO_L0", "DEMO_L7", "DEMO_R0", "DEMO_R7"):
            assert mongo.users.find_one({"uid": uid})["sponsor"] == ROOT_ADDR, uid
        # deeper nodes (i >= 8) are sponsored by their binary parent uids[(i-1)//2]
        l8 = mongo.users.find_one({"uid": "DEMO_L8"})
        assert l8["sponsor"] == addrs["DEMO_L3"], l8["sponsor"]
        assert l8["total_deposited"] == LEG_STAKE and l8["is_active"] is True
        assert mongo.users.count_documents(
            {"uid": {"$regex": "^DEMO_[LR]"}, "total_deposited": LEG_STAKE, "is_active": True}
        ) == 2 * LEG_NODES

    def test_02_seed_demo_idempotent(self, api, mongo):
        r = api.post(f"{API}/reward/tree/seed-demo")
        assert r.status_code == 200
        assert r.json()["seeded"] == 51
        assert mongo.users.count_documents({"uid": {"$regex": "^DEMO"}}) == 51

    # --- build #1 : ROOT qualifies but is still on the STANDARD 200% cap ---
    def test_03_first_build_standard_cap_and_flags_owner(self, api, mongo):
        r = api.post(f"{API}/reward/tree/build")
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        d = r.json()
        assert HEX_ROOT.match(d["root"]), d["root"]
        assert d["leaf_count"] > 0 and d["user_count"] >= 51
        assert isinstance(d["proofs"], list) and len(d["proofs"]) == d["leaf_count"]
        assert "_id" not in d
        p = d["proofs"][0]
        for k in ("address", "amount_wei", "capReduce", "proof"):
            assert k in p, p
        assert isinstance(p["amount_wei"], str)
        for k in ("daily", "weekly", "monthly"):
            assert d["pools"][k] >= 0

        bd = _bd(api, ROOT_ADDR)["breakdown"]
        assert bd["monthly_qualified"] is True, bd
        # Owner-Club is now granted and reflected in the SAME build run (no 1-run lag)
        assert bd["owner_tier"] is True, "owner_tier must apply in the same build run"
        assert bd["mining_cap_usd"] == 3000, bd            # 300% of $1000
        # one-time Owner-Club now persisted in db.users
        assert mongo.users.find_one({"uid": "DEMO_ROOT"})["owner_tier"] is True, \
            "owner_tier not persisted after first qualifying build"

    # --- build #2 : one-time Owner-Club now yields the 300% cap ---
    def test_04_second_build_owner_club_300pct(self, api, seed_addrs):
        r = api.post(f"{API}/reward/tree/build")
        assert r.status_code == 200, r.text[:300]
        bd = _bd(api, ROOT_ADDR)["breakdown"]
        assert bd["owner_tier"] is True, bd
        assert bd["mining_cap_usd"] == 3000, bd            # 300% of $1000
        assert bd["self_roi_usd"] == 600, bd               # 40d * 3000 * 0.5%
        # standard (non-qualified) user stays at 200%
        std = _bd(api, seed_addrs["DEMO_L20"])["breakdown"]
        assert std["owner_tier"] is False, std
        assert std["mining_cap_usd"] == LEG_STAKE * 2, std  # 200% of $250

    def test_05_build_is_deterministic(self, api):
        r1 = api.post(f"{API}/reward/tree/build")
        r2 = api.post(f"{API}/reward/tree/build")
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["root"] == r2.json()["root"], "root not deterministic on unchanged data"
        assert r1.json()["leaf_count"] == r2.json()["leaf_count"]

    def test_06_latest_root_matches_build(self, api):
        b = api.post(f"{API}/reward/tree/build").json()
        latest = api.get(f"{API}/reward/merkle/latest")
        assert latest.status_code == 200
        assert latest.json()["root"] == b["root"]

    # --- ROOT breakdown: full monthly-qualification criteria ---
    def test_07_root_qualification_breakdown(self, api):
        d = _bd(api, ROOT_ADDR)
        bd = d["breakdown"]
        assert HEX_ROOT.match(d["root"])
        assert bd["address"] == ROOT_ADDR
        assert bd["active_directs"] == ROOT_DIRECTS, bd
        assert bd["qualified_directs"] == ROOT_DIRECTS, bd
        assert bd["direct_business_usd"] == ROOT_DIRECT_BUSINESS, bd
        assert bd["binary"]["left_ids"] == LEG_NODES, bd
        assert bd["binary"]["right_ids"] == LEG_NODES, bd
        assert bd["binary"]["left_business_usd"] == LEG_BUSINESS, bd
        assert bd["binary"]["right_business_usd"] == LEG_BUSINESS, bd
        assert bd["monthly_qualified"] is True, bd
        assert bd["rank"] == "Diamond", bd                  # 16 directs / $5600
        assert bd["level_income_usd"] == pytest.approx(EXPECTED_ROOT_LEVEL_INCOME), bd
        assert bd["level_lapsed_usd"] == 0, bd              # Diamond unlocks L1-L15
        assert bd["monthly_pool_usd"] > 0, "qualified achiever got no monthly pool share"
        # two cumulative streams: A = self ROI + level + monthly, B = daily + weekly
        assert bd["claimable_stream_a_usd"] == pytest.approx(
            bd["self_roi_usd"] + bd["level_income_usd"] + bd["monthly_pool_usd"], rel=1e-9), bd
        assert bd["claimable_stream_b_usd"] == pytest.approx(
            bd["daily_pool_usd"] + bd["weekly_pool_usd"], rel=1e-9), bd
        assert bd["total_claimable_usd"] == pytest.approx(
            bd["claimable_stream_a_usd"] + bd["claimable_stream_b_usd"], rel=1e-9), bd
        assert len(d["proofs"]) >= 1

    # --- non-qualifying leaf gets NO monthly share ---
    def test_08_leaf_not_qualified_no_monthly_share(self, api, seed_addrs):
        bd = _bd(api, seed_addrs["DEMO_L20"])["breakdown"]
        assert bd["monthly_qualified"] is False, bd
        assert bd["monthly_pool_usd"] == 0, bd
        assert bd["active_directs"] == 0 and bd["direct_business_usd"] == 0, bd
        assert bd["binary"]["left_ids"] == 0 and bd["binary"]["right_ids"] == 0, bd
        assert bd["binary"]["left_business_usd"] == 0 and bd["binary"]["right_business_usd"] == 0, bd
        assert bd["level_income_usd"] == 0, bd

    # --- interior leg node sees only its own binary subtree ---
    def test_09_interior_leg_node_binary_stats(self, api, seed_addrs):
        bd = _bd(api, seed_addrs["DEMO_L0"])["breakdown"]
        b = bd["binary"]
        assert b["left_ids"] + b["right_ids"] == LEG_NODES - 1, b       # 24 below L0
        assert b["left_business_usd"] + b["right_business_usd"] == (LEG_NODES - 1) * LEG_STAKE, b
        assert bd["monthly_qualified"] is False, bd                    # < 25 ids per leg
        assert bd["monthly_pool_usd"] == 0, bd

    def test_10_unknown_address_404(self, api):
        r = api.get(f"{API}/reward/tree/user/0x00000000000000000000000000000000000000ff")
        assert r.status_code == 404, f"{r.status_code} {r.text[:300]}"
        assert "detail" in r.json()

    def test_11_case_insensitive_lookup(self, api):
        r = api.get(f"{API}/reward/tree/user/{to_checksum_address(ROOT_ADDR)}")
        assert r.status_code == 200, r.text[:300]
        assert r.json()["breakdown"]["level_income_usd"] == pytest.approx(
            EXPECTED_ROOT_LEVEL_INCOME)

    # --- OZ proof verification ---
    def test_12_all_proofs_verify_against_root(self, api):
        d = api.post(f"{API}/reward/tree/build").json()
        root = d["root"]
        bad = []
        for p in d["proofs"]:
            leaf = merkle.leaf_hash(p["address"], int(p["amount_wei"]), p["capReduce"])
            if not _oz_verify(leaf, p["proof"], root):
                bad.append(p["address"])
        assert not bad, f"{len(bad)}/{len(d['proofs'])} proofs failed verification: {bad[:5]}"
        assert len(d["proofs"]) > 50

    def test_13_tampered_proof_fails(self, api):
        d = api.post(f"{API}/reward/tree/build").json()
        p = d["proofs"][0]
        leaf = merkle.leaf_hash(p["address"], int(p["amount_wei"]) + 1, p["capReduce"])
        assert not _oz_verify(leaf, p["proof"], d["root"]), "tampered amount still verified"

    def test_14_user_proof_matches_snapshot_root(self, api):
        api.post(f"{API}/reward/tree/build")
        d = _bd(api, ROOT_ADDR)
        for p in d["proofs"]:
            leaf = merkle.leaf_hash(p["address"], int(p["amount_wei"]), p["capReduce"])
            assert _oz_verify(leaf, p["proof"], d["root"]), p["address"]

    # --- level income is bounded at exactly 15 levels (unit test on tree_engine) ---
    def test_15_level_income_capped_at_15_levels(self):
        chain = []
        for i in range(21):
            chain.append({
                "address": "0x" + f"{(0xA000 + i):040x}",
                "sponsor": ("0x" + f"{(0xA000 + i - 1):040x}") if i else None,
                "binary_parent": None, "binary_side": None,
                "stake_usd": 100.0 if i == 20 else 0.0,
                "owner_tier": False, "active": True,
                "activated_at": None,
            })
        _, bd = tree_engine.compute(chain, {"daily": 0, "weekly": 0, "monthly": 0})
        lvl_bps = [700, 300, 300, 200, 200, 200, 100, 100, 100, 50, 50, 50, 50, 50, 50]
        for dist in range(1, 16):
            a = chain[20 - dist]["address"].lower()
            total = bd[a]["level_income_usd"] + bd[a]["level_lapsed_usd"]
            assert total == pytest.approx(100.0 * lvl_bps[dist - 1] / 10000), \
                f"L{dist} credit wrong: {total}"
        for dist in range(16, 21):
            a = chain[20 - dist]["address"].lower()
            total = bd[a]["level_income_usd"] + bd[a]["level_lapsed_usd"]
            assert total == 0, f"level income leaked beyond L15 at distance {dist}: {total}"

    # --- Referral capture via SIWE auth ---
    def test_16_ref_by_uid_stored(self, api, mongo, created_addresses):
        sponsor = mongo.users.find_one({"uid": "DEMO_ROOT"})
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

    def test_17_ref_by_address_stored(self, api, mongo, created_addresses):
        addr, r = _auth_new_wallet(api, ref=ROOT_ADDR)
        created_addresses.append(addr)
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        doc = mongo.users.find_one({"address": addr.lower()})
        assert doc.get("sponsor") == ROOT_ADDR, doc.get("sponsor")

    def test_18_unknown_ref_leaves_sponsor_null(self, api, mongo, created_addresses):
        addr, r = _auth_new_wallet(api, ref="TTN999999")
        created_addresses.append(addr)
        assert r.status_code == 200, r.text[:400]
        doc = mongo.users.find_one({"address": addr.lower()})
        assert doc.get("sponsor") is None, doc.get("sponsor")

    def test_19_bad_signature_rejected(self, api):
        acct = Account.create()
        other = Account.create()
        n = api.get(f"{API}/auth/nonce", params={"address": acct.address}).json()
        msg = f"TITAN Sign-In\nAddress: {acct.address}\nChain ID: {n['chain_id']}\nNonce: {n['nonce']}"
        sig = Account.sign_message(encode_defunct(text=msg), private_key=other.key)
        r = api.post(f"{API}/auth/verify", json={
            "address": acct.address, "message": msg,
            "signature": sig.signature.hex(), "nonce": n["nonce"]})
        assert r.status_code == 401, f"{r.status_code} {r.text[:300]}"

    # --- new sponsored (inactive, zero-stake) user must not change ROOT's numbers ---
    def test_20_new_referral_appears_in_tree(self, api, mongo, created_addresses):
        before = api.post(f"{API}/reward/tree/build").json()
        addr, r = _auth_new_wallet(api, ref=ROOT_ADDR)
        created_addresses.append(addr)
        assert r.status_code == 200, r.text[:300]
        after = api.post(f"{API}/reward/tree/build").json()
        # >= because other xdist workers may also create wallets concurrently
        assert after["user_count"] >= before["user_count"] + 1
        bd = _bd(api, addr.lower())["breakdown"]
        assert bd["mining_cap_usd"] == 0 and bd["total_claimable_usd"] == 0
        assert bd["monthly_qualified"] is False, bd
        rb = _bd(api, ROOT_ADDR)["breakdown"]
        assert rb["direct_business_usd"] == ROOT_DIRECT_BUSINESS, rb
        assert rb["active_directs"] == ROOT_DIRECTS, rb
        assert rb["level_income_usd"] == pytest.approx(EXPECTED_ROOT_LEVEL_INCOME), rb
        assert rb["monthly_qualified"] is True, rb

    # --- Owner-Club is ONE-TIME: cap stays 300% even after losing qualification ---
    def test_21_owner_club_permanent_after_losing_qualification(self, api, mongo, seed_addrs):
        l24 = seed_addrs["DEMO_L24"].lower()
        try:
            mongo.users.update_one({"address": l24}, {"$set": {"is_active": False}})
            api.post(f"{API}/reward/tree/build")
            bd = _bd(api, ROOT_ADDR)["breakdown"]
            assert bd["binary"]["left_ids"] == LEG_NODES - 1, bd
            assert bd["monthly_qualified"] is False, "qualification should lapse with 24 left IDs"
            assert bd["monthly_pool_usd"] == 0, bd
            # one-time grant must survive
            assert bd["owner_tier"] is True, bd
            assert bd["mining_cap_usd"] == 3000, bd
            assert mongo.users.find_one({"uid": "DEMO_ROOT"})["owner_tier"] is True
        finally:
            mongo.users.update_one({"address": l24}, {"$set": {"is_active": True}})
            api.post(f"{API}/reward/tree/build")
        bd2 = _bd(api, ROOT_ADDR)["breakdown"]
        assert bd2["monthly_qualified"] is True and bd2["monthly_pool_usd"] > 0, bd2

    # --- monthly pool splits EQUALLY among achievers (pure unit test) ---
    def test_22_monthly_pool_equal_split_among_achievers(self):
        def group(base):
            root = "0x" + f"{base:040x}"
            users = [{"address": root, "sponsor": None, "binary_parent": None,
                      "binary_side": None, "stake_usd": 1000.0, "owner_tier": False,
                      "active": True, "activated_at": None}]
            for leg, side_label in (("L", "left"), ("R", "right")):
                offset = base + (1 if leg == "L" else 26)
                addrs = ["0x" + f"{(offset + i):040x}" for i in range(25)]
                for i, a in enumerate(addrs):
                    bp, side = (root, side_label) if i == 0 else (
                        addrs[(i - 1) // 2], "left" if i % 2 else "right")
                    users.append({"address": a, "sponsor": root if i < 5 else bp,
                                  "binary_parent": bp, "binary_side": side,
                                  "stake_usd": 250.0, "owner_tier": False,
                                  "active": True, "activated_at": None})
            return root, users

        r1, g1 = group(0x100000)
        r2, g2 = group(0x200000)
        _, bd = tree_engine.compute(g1 + g2, {"daily": 0, "weekly": 0, "monthly": 1000.0})
        assert bd[r1]["monthly_qualified"] is True and bd[r2]["monthly_qualified"] is True
        assert bd[r1]["monthly_pool_usd"] == 500.0, bd[r1]
        assert bd[r2]["monthly_pool_usd"] == 500.0, bd[r2]
        # everyone else gets nothing
        others = [a for a in bd if a not in (r1, r2)]
        assert all(bd[a]["monthly_pool_usd"] == 0 for a in others)
        assert all(bd[a]["monthly_qualified"] is False for a in others)
