"""TITAN off-chain Reward Engine tests: /api/reward/config, /simulate, /monthly-qualify."""
import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
API = base_url.rstrip("/") + "/api"

EXPECTED_PCT = [7.0, 3.0, 3.0, 2.0, 2.0, 2.0, 1.0, 1.0, 1.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def sim(client, **kw):
    payload = {"stake_usd": 100, "owner_tier": False, "active_directs": 0,
               "direct_business_usd": 0.0, "downline_stake_usd": 0.0}
    payload.update(kw)
    r = client.post(f"{API}/reward/simulate", json=payload, timeout=30)
    return r


def qual(client, **kw):
    payload = {"active_directs": 0, "direct_business_usd": 0.0, "left_ids": 0,
               "right_ids": 0, "left_carry_usd": 0.0, "right_carry_usd": 0.0}
    payload.update(kw)
    return client.post(f"{API}/reward/monthly-qualify", json=payload, timeout=30)


# ---------- GET /api/reward/config ----------
class TestRewardConfig:
    def test_config_values(self, client):
        r = client.get(f"{API}/reward/config", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total_level_pct"] == 25.0
        assert d["daily_roi_pct"] == 0.5
        assert d["standard_cap_pct"] == 200.0
        assert d["owner_cap_pct"] == 300.0
        assert d["level_pct"] == EXPECTED_PCT
        assert abs(sum(d["level_pct"]) - 25.0) < 1e-9
        assert sum(d["level_bps"]) == 2500
        assert len(d["level_bps"]) == 15

    def test_config_ranks(self, client):
        d = client.get(f"{API}/reward/config", timeout=30).json()
        names = [x["name"] for x in d["ranks"]]
        assert names == ["Active", "Star", "Silver", "Gold", "Diamond"]
        maxlv = {x["name"]: x["max_level"] for x in d["ranks"]}
        assert maxlv == {"Active": 1, "Star": 3, "Silver": 6, "Gold": 9, "Diamond": 15}

    def test_no_mongo_id(self, client):
        assert "_id" not in client.get(f"{API}/reward/config", timeout=30).text


# ---------- POST /api/reward/simulate ----------
class TestSimulate:
    def test_silver_case(self, client):
        r = sim(client, stake_usd=100, owner_tier=False, active_directs=5,
                direct_business_usd=1000, downline_stake_usd=100)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["rank"] == "Silver"
        assert d["mining_cap_usd"] == 200
        assert d["self_daily_roi_usd"] == 1.0
        assert d["roi_days_to_full"] == 200
        li = d["level_income"]
        assert len(li) == 15
        for row in li[:6]:
            assert row["unlocked"] is True and row["payable_usd"] > 0 and row["lapsed_usd"] == 0
        for row in li[6:]:
            assert row["unlocked"] is False and row["payable_usd"] == 0 and row["lapsed_usd"] > 0

    def test_level_amounts(self, client):
        d = sim(client, downline_stake_usd=100, active_directs=10,
                direct_business_usd=2000).json()
        by_lvl = {x["level"]: x for x in d["level_income"]}
        assert by_lvl[1]["amount_usd"] == 7.0
        assert by_lvl[2]["amount_usd"] == 3.0
        assert by_lvl[7]["amount_usd"] == 1.0
        assert by_lvl[10]["amount_usd"] == 0.5
        assert abs(sum(x["amount_usd"] for x in d["level_income"]) - 25.0) < 1e-6

    def test_owner_diamond(self, client):
        d = sim(client, stake_usd=100, owner_tier=True, active_directs=15,
                direct_business_usd=5000, downline_stake_usd=100,
                team_business_usd=5000).json()
        assert d["rank"] == "Diamond"
        assert d["mining_cap_usd"] == 300
        assert d["self_daily_roi_usd"] == 1.5
        assert d["roi_days_to_full"] == 200
        assert all(x["unlocked"] for x in d["level_income"])
        assert sum(x["lapsed_usd"] for x in d["level_income"]) == 0

    def test_rank_ladder(self, client):
        # AETHERA ladder (Diamond needs $5000 team business, not a simulate input -> max Gold)
        cases = [
            (0, 0, "Active", 1),
            (2, 999, "Active", 1),
            (3, 500, "Active", 1),
            (5, 0, "Star", 3),
            (5, 999, "Star", 3),
            (5, 1000, "Silver", 6),
            (9, 5000, "Silver", 6),
            (10, 2000, "Gold", 9),
            (15, 5000, "Gold", 9),
        ]
        for directs, biz, rank, maxlv in cases:
            d = sim(client, active_directs=directs, direct_business_usd=biz,
                    downline_stake_usd=100).json()
            unlocked = sum(1 for x in d["level_income"] if x["unlocked"])
            assert d["rank"] == rank, f"directs={directs} biz={biz} -> {d['rank']}"
            assert unlocked == maxlv

    def test_gold_rank_reachable(self, client):
        """Gold (L7-L9) must be attainable; Diamond should need stricter criteria."""
        d = sim(client, active_directs=10, direct_business_usd=2000).json()
        assert d["rank"] == "Gold", (
            "Gold and Diamond share identical thresholds (10 directs/$2000), so Gold is "
            f"unreachable — got {d['rank']}"
        )

    def test_pools(self, client):
        d = sim(client, stake_usd=1000).json()
        p = d["pools_from_this_stake"]
        assert p["daily_pool_usd"] == 50.0
        assert p["weekly_pool_usd"] == 50.0
        assert p["monthly_pool_usd"] == 10.0
        assert p["daily_net_usd"] == 45.0
        assert p["weekly_net_usd"] == 45.0

    def test_owner_cap_scaling(self, client):
        d = sim(client, stake_usd=500, owner_tier=True).json()
        assert d["mining_cap_usd"] == 1500
        assert d["self_daily_roi_usd"] == 7.5
        assert d["roi_days_to_full"] == 200

    def test_zero_downline(self, client):
        d = sim(client, downline_stake_usd=0).json()
        assert all(x["amount_usd"] == 0 for x in d["level_income"])

    def test_validation_errors(self, client):
        assert client.post(f"{API}/reward/simulate", json={"stake_usd": 0}, timeout=30).status_code == 422
        assert client.post(f"{API}/reward/simulate", json={"stake_usd": -5}, timeout=30).status_code == 422
        assert client.post(f"{API}/reward/simulate", json={}, timeout=30).status_code == 422

    def test_negative_downline_rejected(self, client):
        r = client.post(f"{API}/reward/simulate", json={"stake_usd": 100, "downline_stake_usd": -100}, timeout=30)
        assert r.status_code == 422, f"negative downline_stake_usd accepted: {r.text[:300]}"

    def test_negative_directs_rejected(self, client):
        r = client.post(f"{API}/reward/simulate", json={"stake_usd": 100, "active_directs": -5,
                                                       "direct_business_usd": -100}, timeout=30)
        assert r.status_code == 422, f"negative team inputs accepted: {r.text[:300]}"


# ---------- POST /api/reward/monthly-qualify ----------
class TestMonthlyQualify:
    def test_qualified(self, client):
        r = qual(client, active_directs=15, direct_business_usd=5000, left_ids=25,
                 right_ids=25, left_carry_usd=5000, right_carry_usd=5000,
                 team_business_usd=5000)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["owner_club_qualified"] is True
        assert d["cap_multiplier"] == "300%"
        assert d["rank"] == "Diamond"

    def test_low_left_ids(self, client):
        d = qual(client, active_directs=10, direct_business_usd=2000, left_ids=10,
                 right_ids=25, left_carry_usd=5000, right_carry_usd=5000).json()
        assert d["owner_club_qualified"] is False
        assert d["cap_multiplier"] == "200%"

    def test_boundaries(self, client):
        cases = [
            (24, 25, 5000, 5000, False),
            (25, 24, 5000, 5000, False),
            (25, 25, 4999.99, 5000, False),
            (25, 25, 5000, 4999.99, False),
            (26, 30, 6000, 5000, True),
        ]
        for li, ri, lc, rc, exp in cases:
            d = qual(client, active_directs=15, direct_business_usd=5000, left_ids=li,
                     right_ids=ri, left_carry_usd=lc, right_carry_usd=rc,
                     team_business_usd=6000).json()
            assert d["owner_club_qualified"] is exp, f"{(li, ri, lc, rc)} -> {d}"

    def test_non_diamond_never_qualifies(self, client):
        d = qual(client, active_directs=5, direct_business_usd=1000, left_ids=100,
                 right_ids=100, left_carry_usd=99999, right_carry_usd=99999).json()
        assert d["rank"] == "Silver"
        assert d["owner_club_qualified"] is False
        assert d["cap_multiplier"] == "200%"

    def test_defaults(self, client):
        r = client.post(f"{API}/reward/monthly-qualify", json={}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["owner_club_qualified"] is False and d["rank"] == "Active"
