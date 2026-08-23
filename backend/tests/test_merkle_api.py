"""Backend tests: Merkle authorization endpoints + reward engine defect re-verification."""
import os
import re
import time

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

HEX32 = re.compile(r"^0x[0-9a-f]{64}$")

A1 = "0x6cA29Dc3691F6a3B5bd0a7f7a2fCeD8F0BF15ffE"
A2 = "0x98600401aadDb432cAf9698170725900829a4488"
A3 = "0x000000000000000000000000000000000000dEaD"
A4 = "0x1111111111111111111111111111111111111111"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def post_build(api, leaves):
    return api.post(f"{BASE_URL}/api/reward/merkle/build", json={"leaves": leaves}, timeout=30)


# ---------------- Merkle build ----------------
class TestMerkleBuild:
    def test_multi_leaf_root_and_proofs(self, api):
        leaves = [
            {"address": A1, "cumulative_usd": 100.5, "cap_reduce": True},
            {"address": A2, "cumulative_usd": 25, "cap_reduce": False},
            {"address": A3, "cumulative_usd": 0, "cap_reduce": True},
        ]
        r = post_build(api, leaves)
        assert r.status_code == 200, r.text
        d = r.json()
        assert HEX32.match(d["root"]), d["root"]
        assert isinstance(d["proofs"], list) and len(d["proofs"]) == 3
        by_addr = {p["address"].lower(): p for p in d["proofs"]}
        for leaf in leaves:
            p = by_addr[leaf["address"].lower()]
            assert p["amount_wei"] == str(int(round(leaf["cumulative_usd"] * 1e18))), p
            assert isinstance(p["amount_wei"], str)
            assert p["capReduce"] == leaf["cap_reduce"]
            assert isinstance(p["proof"], list) and len(p["proof"]) >= 1
            for h in p["proof"]:
                assert HEX32.match(h), h

    def test_determinism(self, api):
        leaves = [
            {"address": A1, "cumulative_usd": 1000, "cap_reduce": True},
            {"address": A2, "cumulative_usd": 2000, "cap_reduce": True},
            {"address": A4, "cumulative_usd": 3, "cap_reduce": False},
        ]
        roots = []
        proofs = []
        for _ in range(3):
            r = post_build(api, leaves)
            assert r.status_code == 200, r.text
            roots.append(r.json()["root"])
            proofs.append(r.json()["proofs"])
        assert roots[0] == roots[1] == roots[2], roots
        assert proofs[0] == proofs[1] == proofs[2]

    def test_order_independence(self, api):
        l1 = [
            {"address": A1, "cumulative_usd": 10, "cap_reduce": True},
            {"address": A2, "cumulative_usd": 20, "cap_reduce": True},
        ]
        r1 = post_build(api, l1)
        r2 = post_build(api, list(reversed(l1)))
        assert r1.status_code == r2.status_code == 200
        assert r1.json()["root"] == r2.json()["root"]

    def test_single_leaf_empty_proof(self, api):
        r = post_build(api, [{"address": A1, "cumulative_usd": 42.75, "cap_reduce": True}])
        assert r.status_code == 200, r.text
        d = r.json()
        assert HEX32.match(d["root"])
        assert len(d["proofs"]) == 1
        assert d["proofs"][0]["proof"] == []
        assert d["proofs"][0]["amount_wei"] == str(int(round(42.75 * 1e18)))
        # single leaf root must equal the leaf hash (local port cross-check)
        import sys
        sys.path.insert(0, "/app/backend")
        import merkle as m
        assert d["root"] == "0x" + m.leaf_hash(A1, int(round(42.75 * 1e18)), True).hex()

    def test_negative_cumulative_usd_rejected(self, api):
        r = post_build(api, [
            {"address": A1, "cumulative_usd": -5, "cap_reduce": True},
            {"address": A2, "cumulative_usd": 10, "cap_reduce": True},
        ])
        assert r.status_code == 422, f"expected 422 got {r.status_code}: {r.text[:300]}"

    def test_empty_leaves(self, api):
        r = post_build(api, [])
        assert r.status_code in (200, 422), r.text
        if r.status_code == 200:
            d = r.json()
            assert d["proofs"] == []
            assert d["root"] == "0x" + "00" * 32

    def test_invalid_address_not_500(self, api):
        r = post_build(api, [
            {"address": "notanaddress", "cumulative_usd": 1, "cap_reduce": True},
            {"address": A2, "cumulative_usd": 2, "cap_reduce": True},
        ])
        assert r.status_code in (400, 422), f"expected 4xx got {r.status_code}: {r.text[:300]}"

    def test_default_cap_reduce_true(self, api):
        r = post_build(api, [{"address": A2, "cumulative_usd": 7}])
        assert r.status_code == 200, r.text
        assert r.json()["proofs"][0]["capReduce"] is True


# ---------------- Merkle latest ----------------
class TestMerkleLatest:
    def test_latest_reflects_new_build(self, api):
        leaves = [
            {"address": A3, "cumulative_usd": 111.111111, "cap_reduce": False},
            {"address": A4, "cumulative_usd": 222, "cap_reduce": True},
        ]
        b = post_build(api, leaves)
        assert b.status_code == 200, b.text
        root = b.json()["root"]
        time.sleep(0.5)
        r = api.get(f"{BASE_URL}/api/reward/merkle/latest", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["root"] == root, d
        assert d["leaf_count"] == 2
        assert isinstance(d.get("created_at"), str) and len(d["created_at"]) > 0
        assert "_id" not in d


# ---------------- Reward engine defect re-verification ----------------
class TestRewardEngineFixes:
    def _sim(self, api, payload):
        return api.post(f"{BASE_URL}/api/reward/simulate", json=payload, timeout=30)

    def test_gold_rank_reachable(self, api):
        r = self._sim(api, {"stake_usd": 1000, "active_directs": 10,
                            "direct_business_usd": 2000, "downline_stake_usd": 1000})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["rank"] == "Gold", d["rank"]
        unlocked = {l["level"]: l["unlocked"] for l in d["level_income"]}
        for lvl in (7, 8, 9):
            assert unlocked[lvl] is True, f"level {lvl} should be unlocked for Gold"
        assert unlocked[10] is False, "level 10 must be locked for Gold"

    def test_diamond_all_levels(self, api):
        r = self._sim(api, {"stake_usd": 1000, "active_directs": 15,
                            "direct_business_usd": 5000, "downline_stake_usd": 1000})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["rank"] == "Diamond"
        assert all(l["unlocked"] for l in d["level_income"])
        assert len(d["level_income"]) == 15

    @pytest.mark.parametrize("field", ["downline_stake_usd", "direct_business_usd"])
    def test_negative_rejected(self, api, field):
        payload = {"stake_usd": 1000, "active_directs": 1, "direct_business_usd": 0,
                   "downline_stake_usd": 0}
        payload[field] = -100
        r = self._sim(api, payload)
        assert r.status_code == 422, f"{field}: expected 422 got {r.status_code}"

    def test_negative_directs_and_zero_stake(self, api):
        r = self._sim(api, {"stake_usd": 1000, "active_directs": -1})
        assert r.status_code == 422
        r = self._sim(api, {"stake_usd": 0})
        assert r.status_code == 422

    def test_rank_ladder_boundaries(self, api):
        cases = [
            (0, 0, "Active"), (3, 500, "Star"), (5, 1000, "Silver"),
            (9, 2000, "Silver"), (10, 1999, "Silver"),
            (10, 2000, "Gold"), (14, 5000, "Gold"), (15, 4999, "Gold"),
            (15, 5000, "Diamond"),
        ]
        for directs, biz, expected in cases:
            r = self._sim(api, {"stake_usd": 100, "active_directs": directs,
                                "direct_business_usd": biz, "downline_stake_usd": 100})
            assert r.status_code == 200, r.text
            assert r.json()["rank"] == expected, f"({directs},{biz}) -> {r.json()['rank']}, want {expected}"


# ---------------- Related endpoints smoke ----------------
class TestRewardMisc:
    def test_config(self, api):
        r = api.get(f"{BASE_URL}/api/reward/config", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["total_level_pct"] == 25.0
        assert len(d["level_bps"]) == 15
        assert [x["name"] for x in d["ranks"]] == ["Active", "Star", "Silver", "Gold", "Diamond"]

    def test_monthly_qualify(self, api):
        ok = api.post(f"{BASE_URL}/api/reward/monthly-qualify", json={
            "active_directs": 15, "direct_business_usd": 5000, "left_ids": 25,
            "right_ids": 25, "left_carry_usd": 5000, "right_carry_usd": 5000}, timeout=30)
        assert ok.status_code == 200, ok.text
        assert ok.json()["owner_club_qualified"] is True
        assert ok.json()["cap_multiplier"] == "300%"
        no = api.post(f"{BASE_URL}/api/reward/monthly-qualify", json={
            "active_directs": 15, "direct_business_usd": 5000, "left_ids": 24,
            "right_ids": 25, "left_carry_usd": 5000, "right_carry_usd": 5000}, timeout=30)
        assert no.status_code == 200
        assert no.json()["owner_club_qualified"] is False
        assert no.json()["cap_multiplier"] == "200%"

    def test_health(self, api):
        r = api.get(f"{BASE_URL}/api/health", timeout=30)
        assert r.status_code == 200


# ---------------- Edge cases ----------------
class TestMerkleEdge:
    def test_duplicate_address_leaves(self, api):
        """Same address twice -> currently accepted; flags double-claim risk."""
        r = post_build(api, [
            {"address": A1, "cumulative_usd": 10, "cap_reduce": True},
            {"address": A1, "cumulative_usd": 20, "cap_reduce": True},
        ])
        print("dup status", r.status_code, r.text[:200])
        assert r.status_code in (200, 400, 422)

    def test_large_amount(self, api):
        r = post_build(api, [
            {"address": A1, "cumulative_usd": 1e9, "cap_reduce": True},
            {"address": A2, "cumulative_usd": 0.000001, "cap_reduce": True},
        ])
        assert r.status_code == 200, r.text
        amts = {p["address"].lower(): int(p["amount_wei"]) for p in r.json()["proofs"]}
        assert amts[A1.lower()] == int(round(1e9 * 1e18))
        assert amts[A2.lower()] == 10 ** 12

    def test_many_leaves(self, api):
        leaves = [{"address": "0x" + f"{i:040x}", "cumulative_usd": i + 1, "cap_reduce": i % 2 == 0}
                  for i in range(1, 51)]
        r = post_build(api, leaves)
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["proofs"]) == 50
        assert all(1 <= len(p["proof"]) <= 8 for p in d["proofs"])
