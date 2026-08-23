"""TITAN — MONTHLY OWNER POOL 10% deduction funding (AETHERA slide 10) — iteration 16.

New contract under test:
  * 10% is deducted from every user's Direct+Level+Daily+Weekly payout (user gets NET 90%).
  * Self ROI is NOT deducted.
  * Monthly Owner pool = base pool (protocol_stats.monthly_pool_usdt) + sum of all deductions,
    split EQUALLY among qualified Owners (Diamond + 10 directs + $2000 direct biz +
    25 qualified IDs & $5000 business per leg).
  * /api/pools estimates: daily/weekly are NET (x0.9), monthly has NO further deduction.
  * Leadership ranks: Star 5 directs, Silver 5+$1000, Gold 10+$2000,
    Diamond 10 directs + $2000 direct + $5000 15-level team business.

Everything lives in ONE class so pytest-xdist loadscope keeps it on a single worker
(the backend has a single global reward snapshot).
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
import tree_engine  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing from env and /app/frontend/.env")
API = f"{base_url.rstrip('/')}/api"

backend_env = dotenv_values("/app/backend/.env")
MONGO_URL = backend_env.get("MONGO_URL")
DB_NAME = backend_env.get("DB_NAME")

DAILY_POOL = 3200.0
WEEKLY_POOL = 7000.0
MONTHLY_POOL = 9000.0
NET = 0.9
DEDUCT = 0.1

NOW = datetime.now(timezone.utc)
ACT = (NOW - timedelta(days=1)).isoformat()


def qaddr(i: int) -> str:
    return "0x" + f"{(0xB0000 + i):040x}"


D_ROOT = qaddr(1)   # 1 qualified direct -> daily only
E_ROOT = qaddr(2)   # 5 qualified directs -> daily + weekly


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
def network(mongo, api):
    """Seed DEMO network + QD_* pool users with deterministic pool balances."""
    prev = mongo.protocol_stats.find_one({"_id": "protocol"}) or {}
    prev_pools = {k: prev.get(k) for k in
                  ("daily_pool_usdt", "weekly_pool_usdt", "monthly_pool_usdt")}

    def u(a, sponsor, stake, uid):
        return {"address": a, "uid": uid, "sponsor": sponsor,
                "binary_parent": None, "binary_side": None,
                "total_deposited": stake, "is_active": True, "owner_tier": False,
                "activated_at": ACT, "created_at": NOW.isoformat()}

    docs = [u(D_ROOT, None, 1000, "QD_D"), u(qaddr(10), D_ROOT, 50, "QD_D_1"),
            u(E_ROOT, None, 1000, "QD_E")]
    docs += [u(qaddr(20 + i), E_ROOT, 50, f"QD_E_{i}") for i in range(5)]

    mongo.users.delete_many({"uid": {"$regex": "^QD_"}})
    r = api.post(f"{API}/reward/tree/seed-demo", timeout=120)
    assert r.status_code == 200, r.text
    mongo.users.insert_many(docs)
    mongo.protocol_stats.update_one(
        {"_id": "protocol"},
        {"$set": {"daily_pool_usdt": DAILY_POOL, "weekly_pool_usdt": WEEKLY_POOL,
                  "monthly_pool_usdt": MONTHLY_POOL}}, upsert=True)
    yield r.json()["root_address"].lower()
    mongo.users.delete_many({"uid": {"$regex": "^QD_"}})
    restore = {k: v for k, v in prev_pools.items() if v is not None}
    if restore:
        mongo.protocol_stats.update_one({"_id": "protocol"}, {"$set": restore})
    try:
        requests.post(f"{API}/reward/tree/build", timeout=240)
    except Exception:
        pass


class TestMonthlyDeductionFunding:
    root = None
    build = None
    snap = None

    # ---------------------------------------------------------- e2e build
    def test_01_build(self, api, network, mongo):
        TestMonthlyDeductionFunding.root = network
        r = api.post(f"{API}/reward/tree/build", timeout=240)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["root"].startswith("0x") and data["leaf_count"] > 0
        assert data["pools"] == {"daily": DAILY_POOL, "weekly": WEEKLY_POOL,
                                 "monthly": MONTHLY_POOL}
        assert len(data["proofs"]) == data["leaf_count"]
        TestMonthlyDeductionFunding.build = data
        TestMonthlyDeductionFunding.snap = mongo.reward_snapshots.find_one({"_id": "latest"})
        assert self.snap and self.snap["breakdown"]

    def test_02_merkle_latest_matches(self, api):
        r = api.get(f"{API}/reward/merkle/latest", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["root"] == self.build["root"]

    def test_03_demo_root_breakdown_and_proofs(self, api):
        r = api.get(f"{API}/reward/tree/user/{self.root}", timeout=60)
        assert r.status_code == 200, r.text
        p = r.json()
        bd = p["breakdown"]
        assert p["root"] == self.build["root"]
        assert len(p["proofs"]) > 0 and all(isinstance(x["proof"], list) for x in p["proofs"])
        assert bd["rank"] == "Diamond"
        assert bd["monthly_qualified"] is True
        assert bd["owner_tier"] is True, "Owner Club must apply in the SAME build run"
        assert bd["mining_cap_usd"] == pytest.approx(3000.0)
        assert bd["team_business_usd"] >= 5000

    # ------------------------------------------- 10% deduction (core rule)
    def test_04_net_is_90pct_of_gross_for_every_user(self):
        bmap = self.snap["breakdown"]
        assert len(bmap) > 50
        for a, bd in bmap.items():
            assert bd["level_income_net_usd"] == pytest.approx(
                bd["level_income_usd"] * NET, rel=1e-6, abs=1e-6), a
            assert bd["daily_pool_usd"] == pytest.approx(
                bd["daily_pool_gross_usd"] * NET, rel=1e-6, abs=1e-6), a
            assert bd["weekly_pool_usd"] == pytest.approx(
                bd["weekly_pool_gross_usd"] * NET, rel=1e-6, abs=1e-6), a
            assert bd["deducted_to_monthly_usd"] == pytest.approx(
                (bd["level_income_usd"] + bd["daily_pool_gross_usd"]
                 + bd["weekly_pool_gross_usd"]) * DEDUCT, rel=1e-6, abs=1e-6), a

    def test_05_roi_and_monthly_share_not_deducted(self):
        """stream_a = self_roi (full) + net level + monthly share; stream_b = net daily+weekly."""
        bmap = self.snap["breakdown"]
        for a, bd in bmap.items():
            assert bd["claimable_stream_a_usd"] == pytest.approx(
                bd["self_roi_usd"] + bd["level_income_net_usd"] + bd["monthly_pool_usd"],
                rel=1e-6, abs=1e-6), a
            assert bd["claimable_stream_b_usd"] == pytest.approx(
                bd["daily_pool_usd"] + bd["weekly_pool_usd"], rel=1e-6, abs=1e-6), a
            assert bd["total_claimable_usd"] == pytest.approx(
                bd["claimable_stream_a_usd"] + bd["claimable_stream_b_usd"],
                rel=1e-9, abs=1e-6), a

    def test_06_roi_untouched_pure_engine(self):
        """Pure-engine control: ROI must equal days * cap * 0.5% (no 10% haircut)."""
        users = [{"address": "0x" + "1" * 40, "sponsor": None, "binary_parent": None,
                  "binary_side": None, "stake_usd": 1000, "owner_tier": False,
                  "active": True, "activated_at": (NOW - timedelta(days=10)).isoformat()}]
        _, bd = tree_engine.compute(users, {"daily": 100, "weekly": 100, "monthly": 100}, NOW)
        b = bd["0x" + "1" * 40]
        assert b["self_roi_usd"] == pytest.approx(10 * 2000 * 0.005)   # cap 2000, 10 days
        assert b["claimable_stream_a_usd"] == pytest.approx(b["self_roi_usd"])

    def test_07_monthly_pool_total_equals_base_plus_deductions(self):
        bmap = self.snap["breakdown"]
        total_deducted = sum(b["deducted_to_monthly_usd"] for b in bmap.values())
        achievers = [b for b in bmap.values() if b["monthly_qualified"]]
        assert len(achievers) >= 1
        expected_total = MONTHLY_POOL + total_deducted
        assert total_deducted > 0, "deductions must fund the monthly pool"
        for b in achievers:
            assert b["monthly_pool_usd"] == pytest.approx(
                expected_total / len(achievers), rel=1e-6)
        for b in bmap.values():
            if not b["monthly_qualified"]:
                assert b["monthly_pool_usd"] == 0

    def test_08_pool_shares_split_equally_gross(self):
        bmap = self.snap["breakdown"]
        d = [b for b in bmap.values() if b["daily_eligible"]]
        w = [b for b in bmap.values() if b["weekly_eligible"]]
        assert d and w
        assert d[0]["daily_pool_gross_usd"] == pytest.approx(DAILY_POOL / len(d), rel=1e-6)
        assert w[0]["weekly_pool_gross_usd"] == pytest.approx(WEEKLY_POOL / len(w), rel=1e-6)
        assert len({round(b["daily_pool_usd"], 6) for b in d}) == 1
        assert {b["address"] for b in w} <= {b["address"] for b in d}

    # -------------------------------------------------------- /api/pools
    def test_09_pools_endpoint_monthly_balance_and_estimate(self, api):
        bmap = self.snap["breakdown"]
        total_deducted = sum(b["deducted_to_monthly_usd"] for b in bmap.values())
        achievers = sum(1 for b in bmap.values() if b["monthly_qualified"])
        r = api.get(f"{API}/pools/{self.root}", timeout=60)
        assert r.status_code == 200, r.text
        m = r.json()["monthly"]
        assert m["balance"] == pytest.approx(round(MONTHLY_POOL + total_deducted, 2), abs=0.02)
        assert m["achievers"] == achievers
        assert m["qualified"] is True
        # monthly estimate = balance / achievers, NO further deduction
        assert m["estimate"] == pytest.approx(round(m["balance"] / achievers, 2), abs=0.02)
        if achievers == 1:
            assert m["estimate"] == pytest.approx(m["balance"], abs=0.02)
        # matches the snapshot share the achiever actually gets
        assert m["estimate"] == pytest.approx(bmap[self.root]["monthly_pool_usd"], rel=1e-4)

    def test_10_pools_endpoint_daily_weekly_estimates_are_net(self, api):
        r = api.get(f"{API}/pools/{self.root}", timeout=60)
        data = r.json()
        for key, bal in (("daily", DAILY_POOL), ("weekly", WEEKLY_POOL)):
            p = data[key]
            assert p["balance"] == pytest.approx(bal, abs=0.01)
            n = p["achievers"] + (0 if p["qualified"] else 1)
            assert p["estimate"] == pytest.approx(round((p["balance"] / n) * NET, 2), abs=0.02)
        # net estimate must match what the snapshot actually pays the achiever
        bd = self.snap["breakdown"][self.root]
        assert data["daily"]["estimate"] == pytest.approx(bd["daily_pool_usd"], rel=1e-4)
        assert data["weekly"]["estimate"] == pytest.approx(bd["weekly_pool_usd"], rel=1e-4)

    def test_11_pools_non_qualified_user_estimate_uses_n_plus_1(self, api):
        r = api.get(f"{API}/pools/{D_ROOT}", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["in_tree"] is True
        assert data["monthly"]["qualified"] is False
        m = data["monthly"]
        assert m["estimate"] == pytest.approx(round(m["balance"] / (m["achievers"] + 1), 2),
                                              abs=0.02)
        w = data["weekly"]
        assert w["qualified"] is False
        assert w["estimate"] == pytest.approx(
            round((w["balance"] / (w["achievers"] + 1)) * NET, 2), abs=0.02)

    # ------------------------------------- daily/weekly eligibility regression
    def test_12_daily_weekly_eligibility_rules(self, api):
        def bd(a):
            r = api.get(f"{API}/reward/tree/user/{a}", timeout=60)
            assert r.status_code == 200, r.text
            return r.json()["breakdown"]

        d = bd(D_ROOT)
        assert d["qualified_directs"] == 1 and d["daily_eligible"] is True
        assert d["weekly_eligible"] is False and d["weekly_pool_usd"] == 0
        assert d["daily_pool_usd"] > 0
        e = bd(E_ROOT)
        assert e["qualified_directs"] == 5
        assert e["daily_eligible"] is True and e["weekly_eligible"] is True
        assert e["weekly_pool_usd"] > 0

    def test_13_pure_engine_eligibility_caps(self):
        """cap gate: daily needs cap>=100, weekly needs cap>=200 + 5 qualified directs."""
        root = "0x" + "2" * 40
        # own stake $40 -> cap $80 -> blocked from both pools despite 5 qualified directs
        users = [{"address": root, "sponsor": None, "binary_parent": None, "binary_side": None,
                  "stake_usd": 40, "owner_tier": False, "active": True, "activated_at": ACT}]
        users += [{"address": f"0xe{i:039x}", "sponsor": root, "binary_parent": None,
                   "binary_side": None, "stake_usd": 50, "owner_tier": False,
                   "active": True, "activated_at": ACT} for i in range(5)]
        _, bd = tree_engine.compute(users, {"daily": 1000, "weekly": 1000, "monthly": 0}, NOW)
        b = bd[root]
        assert b["mining_cap_usd"] == pytest.approx(80.0)
        assert b["daily_eligible"] is False and b["weekly_eligible"] is False

    # ------------------------------------------------ monthly qualification
    def test_14_monthly_requires_diamond(self):
        """10 directs + $2000 direct business but team business < $5000 -> Gold -> NOT qualified."""
        root = "0x" + "3" * 40
        users = [{"address": root, "sponsor": None, "binary_parent": None, "binary_side": None,
                  "stake_usd": 1000, "owner_tier": False, "active": True, "activated_at": ACT}]
        # 10 directs x $200 = $2000 direct business, $2000 team business (< $5000)
        users += [{"address": f"0xd{i:039x}", "sponsor": root, "binary_parent": None,
                   "binary_side": None, "stake_usd": 200, "owner_tier": False,
                   "active": True, "activated_at": ACT} for i in range(10)]
        # binary legs, balanced so all 25 IDs sit within 15 levels
        # (NOT in the sponsor tree -> no team business contribution)
        for prefix, side in (("a", "left"), ("b", "right")):
            uids = [f"0x{prefix}{i:038x}" for i in range(25)]
            for i, a in enumerate(uids):
                bp = root if i == 0 else uids[(i - 1) // 2]
                s = side if i == 0 else ("left" if i % 2 == 1 else "right")
                users.append({"address": a, "sponsor": None, "binary_parent": bp,
                              "binary_side": s, "stake_usd": 200, "owner_tier": False,
                              "active": True, "activated_at": ACT})
        _, bd = tree_engine.compute(users, {"daily": 0, "weekly": 0, "monthly": 1000}, NOW)
        b = bd[root]
        assert b["binary"]["left_ids"] >= 25 and b["binary"]["right_ids"] >= 25
        assert b["binary"]["left_business_usd"] >= 5000
        assert b["direct_business_usd"] >= 2000 and b["qualified_directs"] >= 10
        assert b["team_business_usd"] < 5000
        assert b["rank"] == "Gold", b["rank"]
        assert b["monthly_qualified"] is False, "Diamond rank is required for the monthly pool"
        assert b["monthly_pool_usd"] == 0

    def test_15_leg_ids_count_only_qualified_50plus(self):
        """Dust ($1) actives must not count toward the 25 qualified IDs per leg."""
        root = "0x" + "4" * 40
        users = [{"address": root, "sponsor": None, "binary_parent": None, "binary_side": None,
                  "stake_usd": 1000, "owner_tier": False, "active": True, "activated_at": ACT}]
        for prefix, side in (("c", "left"), ("f", "right")):
            parent, s = root, side
            for i in range(25):
                a = f"0x{prefix}{i:038x}"
                users.append({"address": a, "sponsor": None, "binary_parent": parent,
                              "binary_side": s, "stake_usd": 1, "owner_tier": False,
                              "active": True, "activated_at": ACT})
                parent, s = a, "left"
        _, bd = tree_engine.compute(users, {"daily": 0, "weekly": 0, "monthly": 0}, NOW)
        b = bd[root]
        assert b["binary"]["left_ids"] == 0, b["binary"]
        assert b["monthly_qualified"] is False

    # -------------------------------------------------------- rank ladder
    @pytest.mark.parametrize("directs,dbiz,tbiz,expected", [
        (4, 600, 0, "Active"),
        (5, 0, 0, "Star"),
        (5, 1000, 0, "Silver"),
        (10, 2000, 0, "Gold"),
        (10, 2000, 5000, "Diamond"),
        (10, 2000, 4000, "Gold"),
        (15, 5000, 0, "Gold"),
    ])
    def test_16_rank_for_escalation(self, directs, dbiz, tbiz, expected):
        assert rw.rank_for(directs, dbiz, tbiz)["name"] == expected

    def test_17_rank_thresholds_config(self):
        by = {r["name"]: r for r in rw.RANKS}
        assert (by["Star"]["directs"], by["Star"]["direct_business"]) == (5, 0)
        assert (by["Silver"]["directs"], by["Silver"]["direct_business"]) == (5, 1000)
        assert (by["Gold"]["directs"], by["Gold"]["direct_business"]) == (10, 2000)
        assert (by["Diamond"]["directs"], by["Diamond"]["direct_business"],
                by["Diamond"]["team_business"]) == (10, 2000, 5000)
        assert [r["max_level"] for r in rw.RANKS] == [1, 3, 6, 9, 15]

    # -------------------------------------------------------- /api/team
    def test_18_team_endpoint_diamond(self, api):
        r = api.get(f"{API}/team/{self.root}", timeout=60)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["rank"] == "Diamond"
        assert t["monthly_qualified"] is True
        q = t["qualification"]
        assert q["unlocked"] == 15, q
        assert q["tiers_unlocked"] == 5, q
        needs = {}
        for lv in q["levels"]:
            assert lv["unlocked"] is True, lv["name"]
            needs[lv["tier"]] = {rq["label"]: (rq["have"], rq["need"]) for rq in lv["reqs"]}
        assert needs["star"]["Active directs"][1] == 5
        assert needs["silver"]["Active directs"][1] == 5
        assert needs["silver"]["Direct business"][1] == 1000
        assert needs["gold"]["Active directs"][1] == 10
        assert needs["gold"]["Direct business"][1] == 2000
        assert needs["diamond"]["Active directs"][1] == 10
        assert needs["diamond"]["Direct business"][1] == 2000
        assert needs["diamond"]["15-level team business"][1] == 5000
        assert needs["diamond"]["15-level team business"][0] >= 5000

    def test_19_team_endpoint_lower_rank_locks_tiers(self, api):
        r = api.get(f"{API}/team/{E_ROOT}", timeout=60)
        assert r.status_code == 200, r.text
        t = r.json()
        # 5 directs x $50 = $250 direct business -> Star only
        assert t["rank"] == "Star", t["rank"]
        q = t["qualification"]
        assert q["unlocked"] == 3, q
        locked = [lv["tier"] for lv in q["levels"] if not lv["unlocked"]]
        assert locked == ["silver", "gold", "diamond"], locked

    def test_20_team_unknown_address_404(self, api):
        r = api.get(f"{API}/team/0x{'e' * 40}", timeout=30)
        assert r.status_code == 404, r.status_code

    # ------------------------------------------------------------- /api/me
    def test_21_me_profit_sources_sum_to_total(self, api):
        r = api.get(f"{API}/me/{self.root}", timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert sum(x["value"] for x in d["profit_sources"]) == pytest.approx(
            d["total_profit_usdt"], rel=1e-6), d["profit_sources"]

    def test_22_me_reflects_snapshot(self, api):
        r = api.get(f"{API}/me/{self.root}", timeout=60)
        d = r.json()
        bd = self.snap["breakdown"][self.root]
        assert d["rank"] == "Diamond" and d["monthly_qualified"] is True
        assert d["total_profit_usdt"] == pytest.approx(bd["total_claimable_usd"], rel=1e-9)
        src = {x["label"]: x["value"] for x in d["profit_sources"]}
        assert src["ROI"] == pytest.approx(bd["self_roi_usd"], rel=1e-9)
        assert src["Daily"] == pytest.approx(bd["daily_pool_usd"], rel=1e-9)
        assert src["Weekly"] == pytest.approx(bd["weekly_pool_usd"], rel=1e-9)
        assert src["Monthly"] == pytest.approx(bd["monthly_pool_usd"], rel=1e-9)
