"""Admin panel API tests: /api/admin/overview, /api/admin/users, /api/admin/user/{address}"""
import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def seeded(client):
    """Seed the demo network + run the reward engine once.

    pytest.ini pins one CLASS per xdist worker (--dist loadscope), so ALL admin tests
    live in a single class below to keep this shared seed race-free.
    """
    r = client.post(f"{API}/reward/tree/seed-demo", timeout=120)
    assert r.status_code == 200, f"seed-demo failed: {r.status_code} {r.text[:300]}"
    seed = r.json()
    assert seed["seeded"] == 51, f"expected 51 seeded nodes, got {seed['seeded']}"
    b = client.post(f"{API}/reward/tree/build", timeout=180)
    assert b.status_code == 200, f"tree/build failed: {b.status_code} {b.text[:300]}"
    build = b.json()
    assert build["root"].startswith("0x")
    return {"seed": seed, "build": build}


# ---------------------------------------------------------------- overview
class TestAdminPanelApi:
    def test_overview_shape_and_values(self, client, seeded):
        r = client.get(f"{API}/admin/overview", timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for k in ("user_count", "active_count", "owner_club_count", "total_staked_usd",
                  "latest_root", "latest_leaf_count", "pools"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["user_count"], int) and d["user_count"] >= 51
        assert isinstance(d["active_count"], int) and d["active_count"] >= 51
        assert d["active_count"] <= d["user_count"]
        assert isinstance(d["total_staked_usd"], (int, float)) and d["total_staked_usd"] >= 13500
        assert isinstance(d["latest_root"], str) and d["latest_root"].startswith("0x")
        assert len(d["latest_root"]) == 66
        assert d["latest_leaf_count"] > 0
        assert isinstance(d["pools"], dict)
        assert {"daily", "weekly", "monthly"} <= set(d["pools"].keys())
        # owner_club_count is order-dependent: seed-demo resets owner_tier, so another
        # test file re-seeding concurrently can legitimately take it back to 0.
        assert isinstance(d["owner_club_count"], int) and d["owner_club_count"] >= 0

    def test_overview_no_mongo_id_leak(self, client, seeded):
        d = client.get(f"{API}/admin/overview", timeout=60).json()
        assert "_id" not in d


    # ------------------------------------------------------------ users list
    def test_users_list_rows_shape(self, client, seeded):
        r = client.get(f"{API}/admin/users", params={"limit": 25}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["page"] == 1 and d["limit"] == 25
        assert isinstance(d["total"], int) and d["total"] >= 51
        assert len(d["rows"]) == 25
        for row in d["rows"]:
            for k in ("address", "uid", "stake_usd", "is_active", "owner_tier", "rank",
                      "mining_cap_usd", "monthly_qualified", "binary",
                      "total_claimable_usd"):
                assert k in row, f"row missing {k}: {row}"
            assert "_id" not in row
            assert row["address"].startswith("0x") and row["address"] == row["address"].lower()
            assert isinstance(row["binary"], dict)
            assert "left_ids" in row["binary"] and "right_ids" in row["binary"]

    def test_search_demo_root(self, client, seeded):
        r = client.get(f"{API}/admin/users", params={"q": "DEMO_ROOT"}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["total"] == 1, f"expected exactly 1 DEMO_ROOT row, got {d['total']}"
        row = d["rows"][0]
        assert row["uid"] == "DEMO_ROOT"
        assert row["rank"] not in (None, "", "-"), f"rank not populated: {row['rank']}"
        assert row["monthly_qualified"] is True
        assert row["binary"]["left_ids"] == 25, row["binary"]
        assert row["binary"]["right_ids"] == 25, row["binary"]
        assert row["stake_usd"] == 1000

    def test_demo_root_owner_club_cap_after_single_build(self, client, seeded):
        """SPEC: DEMO_ROOT monthly-qualifies -> Owner-Club 300% -> mining_cap_usd == 3000.

        DEFECT: /reward/tree/build grants owner_tier AFTER computing the leaves, so the
        300% cap only surfaces on the NEXT engine run (first run reports 2000 = 200%).
        """
        row = client.get(f"{API}/admin/users", params={"q": "DEMO_ROOT"}, timeout=60).json()["rows"][0]
        assert row["monthly_qualified"] is True
        assert row["owner_tier"] is True, "owner_tier flag not persisted after the qualifying run"
        assert row["mining_cap_usd"] == 3000, (
            f"expected Owner-Club cap 3000 on the qualifying run, got {row['mining_cap_usd']} "
            "(owner_tier applied after compute -> cap lags one engine run)"
        )

    def test_search_by_uid_prefix(self, client, seeded):
        r = client.get(f"{API}/admin/users", params={"q": "DEMO_L1"}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        # DEMO_L1, DEMO_L10..DEMO_L19 => 11
        assert d["total"] == 11, f"got {d['total']} for DEMO_L1 prefix"
        assert all(row["uid"].startswith("DEMO_L1") for row in d["rows"])

    def test_search_by_address(self, client, seeded):
        addr = seeded["seed"]["root_address"].lower()
        r = client.get(f"{API}/admin/users", params={"q": addr}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 1
        assert d["rows"][0]["address"] == addr

    def test_search_no_match(self, client, seeded):
        r = client.get(f"{API}/admin/users", params={"q": "ZZZ_NOPE_12345"}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 0 and d["rows"] == []

    def test_pagination(self, client, seeded):
        p1 = client.get(f"{API}/admin/users", params={"page": 1, "limit": 10}, timeout=60).json()
        p2 = client.get(f"{API}/admin/users", params={"page": 2, "limit": 10}, timeout=60).json()
        assert len(p1["rows"]) == 10 and len(p2["rows"]) == 10
        a1 = {r["address"] for r in p1["rows"]}
        a2 = {r["address"] for r in p2["rows"]}
        assert not (a1 & a2), "pagination pages overlap"
        assert p2["page"] == 2

    def test_limit_capped_at_100(self, client, seeded):
        d = client.get(f"{API}/admin/users", params={"limit": 5000}, timeout=60).json()
        assert d["limit"] == 100, f"limit not capped: {d['limit']}"
        assert len(d["rows"]) <= 100

    def test_page_zero_normalised(self, client, seeded):
        d = client.get(f"{API}/admin/users", params={"page": 0, "limit": 5}, timeout=60).json()
        assert d["page"] == 1


    # ------------------------------------------------------------ user detail
    def test_detail_root_user(self, client, seeded):
        addr = seeded["seed"]["root_address"].lower()
        r = client.get(f"{API}/admin/user/{addr}", timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "_id" not in d
        assert d["address"] == addr
        assert d["uid"] == "DEMO_ROOT"
        assert d["sponsor"] is None
        assert d["binary_parent"] is None
        assert d["binary_side"] is None
        assert d["stake_usd"] == 1000
        assert d["is_active"] is True
        assert isinstance(d["breakdown"], dict) and d["breakdown"], "breakdown empty"
        assert d["breakdown"]["monthly_qualified"] is True
        assert isinstance(d["proofs"], list) and len(d["proofs"]) > 0, "no merkle proofs"
        assert d["activated_at"]

    def test_detail_child_has_sponsor_and_binary_parent(self, client, seeded):
        child_addr = seeded["seed"]["addresses"]["DEMO_L0"].lower()
        d = client.get(f"{API}/admin/user/{child_addr}", timeout=60).json()
        assert d["uid"] == "DEMO_L0"
        assert d["sponsor"] == seeded["seed"]["root_address"].lower()
        assert d["binary_parent"] == seeded["seed"]["root_address"].lower()
        assert d["binary_side"] == "left"

    def test_detail_case_insensitive_checksum_address(self, client, seeded):
        addr = seeded["seed"]["root_address"]
        r = client.get(f"{API}/admin/user/{addr.upper().replace('0X', '0x')}", timeout=60)
        assert r.status_code == 200, f"uppercase address lookup failed: {r.status_code}"

    def test_detail_unknown_address_404(self, client, seeded):
        r = client.get(f"{API}/admin/user/0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", timeout=60)
        assert r.status_code == 404, f"expected 404, got {r.status_code}"
        assert "detail" in r.json()
