"""TITAN pool qualification + tree build e2e API tests (iteration 15).

Covers, over the real HTTP API (public preview URL):
  - POST /api/reward/tree/seed-demo
  - POST /api/reward/tree/build (one-time Owner Club applied in SAME run)
  - GET  /api/reward/tree/user/{address}
  - GET  /api/reward/merkle/latest
  - Daily / Weekly / Monthly pool ELIGIBILITY rules
  - Two cumulative streams (stream_a / stream_b) math
  - 15-level income totals 25% + rank gating

All tests live in ONE class so pytest-xdist --dist loadscope keeps them on a single
worker (shared backend state: a single global reward snapshot).
"""
import os
import sys
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
import reward_engine as rw  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing from env and /app/frontend/.env")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

backend_env = dotenv_values("/app/backend/.env")
MONGO_URL = backend_env.get("MONGO_URL")
DB_NAME = backend_env.get("DB_NAME")

DAILY_POOL = 3200.0
WEEKLY_POOL = 7000.0
MONTHLY_POOL = 9000.0


def addr(i: int) -> str:
    """QA addresses far away from the DEMO_* address space (0x..01 - 0x..33)."""
    return "0x" + f"{(0xA0000 + i):040x}"


# QA scenario fixtures ------------------------------------------------------
# A: 1 qualifying direct ($50)   -> DAILY only
# B: 5 qualifying directs ($50)  -> DAILY + WEEKLY
# C: 1 direct with $40 stake     -> NEITHER
# D: qualifying direct but own stake $40 (cap $80 < $100) -> NEITHER
# CHAIN: R -> C1 -> C2 -> C3 (rank gating of level income)
A_ROOT, B_ROOT, C_ROOT, D_ROOT = addr(1), addr(2), addr(3), addr(4)
CHAIN = [addr(90), addr(91), addr(92), addr(93)]


@pytest.fixture(scope="class")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="class")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="class", autouse=True)
def qa_network(mongo):
    """Seed QA users + positive pool amounts; clean up afterwards."""
    now = datetime.now(timezone.utc)
    prev_stats = mongo.protocol_stats.find_one({"_id": "protocol"}) or {}
    prev_pools = {k: prev_stats.get(k) for k in
                  ("daily_pool_usdt", "weekly_pool_usdt", "monthly_pool_usdt")}

    def u(a, sponsor, stake, uid, active=True, days=10):
        return {
            "address": a, "uid": uid, "sponsor": sponsor,
            "binary_parent": None, "binary_side": None,
            "total_deposited": stake, "is_active": active, "owner_tier": False,
            "activated_at": (now - timedelta(days=days)).isoformat(),
            "created_at": now.isoformat(),
        }

    docs = [
        u(A_ROOT, None, 1000, "QA_A"),
        u(addr(10), A_ROOT, 50, "QA_A_D1"),
        u(B_ROOT, None, 1000, "QA_B"),
        u(C_ROOT, None, 1000, "QA_C"),
        u(addr(30), C_ROOT, 40, "QA_C_D1"),
        u(D_ROOT, None, 40, "QA_D"),
        u(addr(40), D_ROOT, 50, "QA_D_D1"),
    ]
    docs += [u(addr(20 + i), B_ROOT, 50, f"QA_B_D{i}") for i in range(5)]
    docs += [u(CHAIN[i], CHAIN[i - 1] if i else None, 100, f"QA_CH{i}") for i in range(4)]

    mongo.users.delete_many({"uid": {"$regex": "^QA_"}})
    mongo.users.insert_many(docs)
    mongo.protocol_stats.update_one(
        {"_id": "protocol"},
        {"$set": {"daily_pool_usdt": DAILY_POOL, "weekly_pool_usdt": WEEKLY_POOL,
                  "monthly_pool_usdt": MONTHLY_POOL}},
        upsert=True,
    )
    yield
    mongo.users.delete_many({"uid": {"$regex": "^QA_"}})
    restore = {k: v for k, v in prev_pools.items() if v is not None}
    if restore:
        mongo.protocol_stats.update_one({"_id": "protocol"}, {"$set": restore})
    # rebuild the snapshot so it no longer references deleted QA users
    try:
        requests.post(f"{API}/reward/tree/build", timeout=180)
    except Exception:
        pass


class TestPoolQualificationE2E:
    demo_root = None
    build_result = None

    # ---------------------------------------------------------------- health
    def test_01_health(self, api):
        r = api.get(f"{API}/health", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    # ------------------------------------------------------------ seed-demo
    def test_02_seed_demo(self, api):
        r = api.post(f"{API}/reward/tree/seed-demo", timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["seeded"] == 51, f"expected 1 root + 50 leg nodes, got {data['seeded']}"
        assert isinstance(data["root_address"], str) and data["root_address"].startswith("0x")
        TestPoolQualificationE2E.demo_root = data["root_address"].lower()

    # ----------------------------------------------------------- tree build
    def test_03_tree_build(self, api):
        r = api.post(f"{API}/reward/tree/build", timeout=180)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["root"] and data["root"].startswith("0x")
        assert data["leaf_count"] > 0
        assert data["user_count"] >= 51
        assert data["pools"]["daily"] == DAILY_POOL
        assert data["pools"]["weekly"] == WEEKLY_POOL
        assert data["pools"]["monthly"] == MONTHLY_POOL
        assert len(data["proofs"]) == data["leaf_count"]
        TestPoolQualificationE2E.build_result = data

    def test_04_merkle_latest_matches_build(self, api):
        assert self.build_result, "build did not run"
        r = api.get(f"{API}/reward/merkle/latest", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["root"] == self.build_result["root"]
        assert data["leaf_count"] == self.build_result["leaf_count"]

    # ------------------------------------------- DEMO_ROOT monthly + owner
    def test_05_demo_root_monthly_and_owner_club(self, api):
        root = self.demo_root
        r = api.get(f"{API}/reward/tree/user/{root}", timeout=60)
        assert r.status_code == 200, r.text
        payload = r.json()
        bd = payload["breakdown"]
        assert bd["monthly_qualified"] is True, bd
        assert bd["owner_tier"] is True, "Owner Club must be applied in the SAME build run"
        assert bd["mining_cap_usd"] == pytest.approx(3000.0), bd["mining_cap_usd"]  # 300% of $1000
        assert bd["rank"] == "Diamond", bd["rank"]
        assert bd["binary"]["left_ids"] >= 25 and bd["binary"]["right_ids"] >= 25
        assert bd["binary"]["left_business_usd"] >= 5000 and bd["binary"]["right_business_usd"] >= 5000
        assert bd["qualified_directs"] >= 10
        assert bd["direct_business_usd"] >= 2000
        assert bd["monthly_pool_usd"] > 0, bd
        assert len(payload["proofs"]) > 0, "Merkle proof array must not be empty"
        assert payload["root"] == self.build_result["root"]

    def test_06_root_matches_merkle_latest(self, api):
        r1 = api.get(f"{API}/reward/tree/user/{self.demo_root}", timeout=60)
        r2 = api.get(f"{API}/reward/merkle/latest", timeout=30)
        assert r1.json()["root"] == r2.json()["root"]

    # ----------------------------------------------- pool eligibility rules
    def _bd(self, api, a):
        r = api.get(f"{API}/reward/tree/user/{a}", timeout=60)
        assert r.status_code == 200, f"{a}: {r.status_code} {r.text}"
        return r.json()["breakdown"]

    def test_07_daily_only_with_one_qualifying_direct(self, api):
        bd = self._bd(api, A_ROOT)
        assert bd["qualified_directs"] == 1, bd
        assert bd["daily_pool_usd"] > 0, "1 qualifying direct + cap>=100 must get a DAILY share"
        assert bd["weekly_pool_usd"] == 0, "weekly needs 5 qualifying directs"

    def test_08_daily_and_weekly_with_five_qualifying_directs(self, api):
        bd = self._bd(api, B_ROOT)
        assert bd["qualified_directs"] == 5, bd
        assert bd["daily_pool_usd"] > 0, bd
        assert bd["weekly_pool_usd"] > 0, "5 qualifying directs + cap>=200 must get a WEEKLY share"

    def test_09_direct_below_50_gets_neither(self, api):
        bd = self._bd(api, C_ROOT)
        assert bd["qualified_directs"] == 0, bd
        assert bd["active_directs"] == 1, bd
        assert bd["daily_pool_usd"] == 0, "direct staked only $40 -> not a qualified direct"
        assert bd["weekly_pool_usd"] == 0, bd

    def test_10_low_own_cap_gets_neither(self, api):
        """Own stake $40 -> cap $80 < $100 daily cap requirement."""
        bd = self._bd(api, D_ROOT)
        assert bd["qualified_directs"] == 1, bd
        assert bd["mining_cap_usd"] == pytest.approx(80.0), bd["mining_cap_usd"]
        assert bd["daily_pool_usd"] == 0, "cap $80 < $100 must block the daily pool"
        assert bd["weekly_pool_usd"] == 0, bd

    def test_11_non_monthly_qualified_users_get_no_monthly_share(self, api):
        for a in (A_ROOT, B_ROOT, C_ROOT, D_ROOT):
            bd = self._bd(api, a)
            assert bd["monthly_qualified"] is False, a
            assert bd["monthly_pool_usd"] == 0, a

    def test_12_pool_shares_split_equally_among_eligible(self, api, mongo):
        """daily_share must equal pool / |eligible set| for every eligible user."""
        snap = mongo.reward_snapshots.find_one({"_id": "latest"})
        bmap = snap["breakdown"]
        daily = [b for b in bmap.values() if b["daily_pool_usd"] > 0]
        weekly = [b for b in bmap.values() if b["weekly_pool_usd"] > 0]
        assert daily and weekly
        # users receive the NET 90% (10% funds the monthly Owner pool)
        assert daily[0]["daily_pool_usd"] == pytest.approx(DAILY_POOL / len(daily) * 0.9, rel=1e-6)
        assert weekly[0]["weekly_pool_usd"] == pytest.approx(WEEKLY_POOL / len(weekly) * 0.9, rel=1e-6)
        # every eligible user gets an identical share
        assert len({round(b["daily_pool_usd"], 6) for b in daily}) == 1
        assert len({round(b["weekly_pool_usd"], 6) for b in weekly}) == 1
        # eligibility is a superset relationship: weekly-eligible are also daily-eligible
        assert {b["address"] for b in weekly} <= {b["address"] for b in daily}

    # --------------------------------------------------- two-stream leaves
    def test_13_stream_math_and_leaf_split(self, api, mongo):
        snap = mongo.reward_snapshots.find_one({"_id": "latest"})
        bmap = snap["breakdown"]
        for a in (self.demo_root, A_ROOT, B_ROOT):
            bd = bmap[a]
            assert bd["total_claimable_usd"] == pytest.approx(
                bd["claimable_stream_a_usd"] + bd["claimable_stream_b_usd"], rel=1e-9)
            # stream_b == daily + weekly only
            assert bd["claimable_stream_b_usd"] == pytest.approx(
                bd["daily_pool_usd"] + bd["weekly_pool_usd"], rel=1e-9), a
            # stream_a == self roi + NET level income (90%) + monthly
            assert bd["claimable_stream_a_usd"] == pytest.approx(
                bd["self_roi_usd"] + bd["level_income_net_usd"] + bd["monthly_pool_usd"],
                rel=1e-6, abs=1e-6), a

        # leaves: one leaf PER CATEGORY (0=ROI 1=Level 2=Daily 3=Weekly 4=Monthly)
        r = api.get(f"{API}/reward/tree/user/{B_ROOT}", timeout=60)
        proofs = r.json()["proofs"]
        cats = sorted(int(p["category"]) for p in proofs)
        assert cats == sorted(set(cats)), f"duplicate category leaves: {proofs}"
        assert set(cats) <= {0, 1, 2, 3, 4} and len(cats) >= 2, proofs
        wei = {int(p["category"]): int(p["amount_wei"]) for p in proofs}
        assert all(v > 0 for v in wei.values()), proofs
        bd = bmap[B_ROOT]
        cat_map = {0: "self_roi_usd", 1: "level_income_net_usd", 2: "daily_pool_usd",
                   3: "weekly_pool_usd", 4: "monthly_pool_usd"}
        for cat, field in cat_map.items():
            if bd[field] > 0:
                assert cat in wei, f"missing category {cat} leaf for {field}"
                assert wei[cat] == pytest.approx(bd[field] * 1e18, rel=1e-9), (cat, field)
            else:
                assert cat not in wei, f"unexpected category {cat} leaf for zero {field}"
        assert sum(wei.values()) == pytest.approx(bd["total_claimable_usd"] * 1e18, rel=1e-6)
        assert all(isinstance(p["proof"], list) for p in proofs)
        assert all("capReduce" not in p for p in proofs)

    # ------------------------------------------------------- level income
    def test_14_level_bps_totals_25pct(self):
        assert len(rw.LEVEL_BPS) == 15
        assert sum(rw.LEVEL_BPS) == 2500
        assert rw.LEVEL_BPS[:1] == [700]
        assert rw.LEVEL_BPS[1:3] == [300, 300]
        assert rw.LEVEL_BPS[3:6] == [200, 200, 200]
        assert rw.LEVEL_BPS[6:9] == [100, 100, 100]
        assert rw.LEVEL_BPS[9:] == [50] * 6

    def test_15_level_income_rank_gated(self, api):
        """QA chain root has 1 direct -> rank Active -> only L1 payable, L2/L3 lapse."""
        bd = self._bd(api, CHAIN[0])
        assert bd["rank"] == "Active", bd["rank"]
        assert bd["level_income_usd"] == pytest.approx(7.0), bd  # 7% of $100 (L1)
        assert bd["level_lapsed_usd"] == pytest.approx(6.0), bd  # L2 3% + L3 3% of $100

    def test_16_diamond_upline_earns_deep_levels(self, api):
        """DEMO_ROOT is Diamond (max_level 15) -> level income spans deep levels."""
        bd = self._bd(api, self.demo_root)
        # 16 directs x $350 x 7% = 392 from L1 alone; deeper levels add more.
        assert bd["level_income_usd"] > 392, bd["level_income_usd"]
        assert bd["level_lapsed_usd"] == pytest.approx(0.0), bd["level_lapsed_usd"]

    def test_17_self_roi_capped_by_mining_cap(self, api):
        bd = self._bd(api, self.demo_root)
        assert bd["self_roi_usd"] <= bd["mining_cap_usd"] + 1e-9
        assert bd["self_roi_usd"] > 0

    # --------------------------------------------------- idempotency / 404s
    def test_18_rebuild_is_stable_and_owner_tier_persists(self, api):
        r = api.post(f"{API}/reward/tree/build", timeout=180)
        assert r.status_code == 200, r.text
        bd = self._bd(api, self.demo_root)
        assert bd["owner_tier"] is True
        assert bd["mining_cap_usd"] == pytest.approx(3000.0)

    def test_19_user_with_no_directs_gets_no_pool(self, api):
        bd = self._bd(api, CHAIN[3])
        assert bd["qualified_directs"] == 0
        assert bd["daily_pool_usd"] == 0 and bd["weekly_pool_usd"] == 0, bd

    def test_20_unknown_address_returns_404(self, api):
        r = api.get(f"{API}/reward/tree/user/0x{'f' * 40}", timeout=30)
        assert r.status_code == 404, r.status_code
