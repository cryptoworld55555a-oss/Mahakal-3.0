"""Direct (pure-function) checks of tree_engine monthly-qualification thresholds.

Updated for the AETHERA-aligned contract (iteration 16):
  (a) monthly qualification REQUIRES Diamond rank (10 directs + $2000 direct business
      + $5000 15-level team business)
  (b) leg IDs count only QUALIFIED ($50+) active IDs, dust actives do not count
Both deviations documented as xfail earlier are now implemented, so these assert the
real behaviour.
"""
import sys
from datetime import datetime, timedelta, timezone

import pytest

sys.path.insert(0, "/app/backend")
import tree_engine  # noqa: E402

NOW = datetime.now(timezone.utc)
ACT = (NOW - timedelta(days=1)).isoformat()


def _u(a, sponsor=None, bp=None, side=None, stake=0.0, active=True):
    return {"address": a, "sponsor": sponsor, "binary_parent": bp, "binary_side": side,
            "stake_usd": stake, "owner_tier": False, "active": active, "activated_at": ACT}


def _balanced_leg(prefix, root, side, count, stake, sponsor_parent=False):
    """Balanced binary leg of `count` nodes under `root` on `side` (fits inside 15 levels)."""
    uids = [f"0x{prefix}{i:038x}" for i in range(count)]
    out = []
    for i, a in enumerate(uids):
        bp = root if i == 0 else uids[(i - 1) // 2]
        s = side if i == 0 else ("left" if i % 2 == 1 else "right")
        out.append(_u(a, sponsor=(bp if sponsor_parent else None), bp=bp, side=s, stake=stake))
    return out


class TestMonthlyRuleEdges:
    def _network(self, direct_stake, leg_stake, leg_in_sponsor_tree=False):
        root = "0x" + "1" * 40
        users = [_u(root, stake=1000)]
        users += [_u(f"0xd{i:039x}", sponsor=root, stake=direct_stake) for i in range(10)]
        users += _balanced_leg("a", root, "left", 25, leg_stake, leg_in_sponsor_tree)
        users += _balanced_leg("b", root, "right", 25, leg_stake, leg_in_sponsor_tree)
        _, bd = tree_engine.compute(users, {"daily": 100, "weekly": 100, "monthly": 100}, NOW)
        return bd[root]

    def test_monthly_requires_diamond_rank(self):
        """10 directs x $200 = $2000 direct biz but team business < $5000 -> Gold -> blocked."""
        bd = self._network(direct_stake=200, leg_stake=200)
        assert bd["team_business_usd"] < 5000
        assert bd["rank"] == "Gold", bd["rank"]
        assert bd["binary"]["left_business_usd"] >= 5000
        assert bd["binary"]["left_ids"] >= 25 and bd["binary"]["right_ids"] >= 25
        assert bd["monthly_qualified"] is False, \
            f"rank={bd['rank']} but monthly_qualified={bd['monthly_qualified']}"

    def test_diamond_with_team_business_qualifies(self):
        """Same shape but the legs are in the sponsor tree -> $5000+ team biz -> Diamond."""
        bd = self._network(direct_stake=200, leg_stake=200, leg_in_sponsor_tree=True)
        assert bd["team_business_usd"] >= 5000
        assert bd["rank"] == "Diamond", bd["rank"]
        assert bd["monthly_qualified"] is True
        assert bd["monthly_pool_usd"] > 0

    def test_leg_ids_count_only_qualified_ids(self):
        """25 leg IDs per leg staking only $1 each must NOT count as qualified IDs."""
        root = "0x" + "1" * 40
        users = [_u(root, stake=1000)]
        users += [_u(f"0xd{i:039x}", sponsor=root, stake=200) for i in range(10)]
        users += _balanced_leg("a", root, "left", 25, 1)
        users += _balanced_leg("b", root, "right", 25, 1)
        _, bd = tree_engine.compute(users, {"daily": 0, "weekly": 0, "monthly": 0}, NOW)
        b = bd[root]
        assert b["binary"]["left_ids"] == 0, b["binary"]
        assert b["monthly_qualified"] is False, "dust ($1) actives are not qualified IDs"
