"""Direct (pure-function) checks of tree_engine monthly-qualification thresholds.

These document two deviations from the stated FINALIZED rule set:
  (a) rule says monthly needs *Diamond rank*; engine only checks 10 directs + $2000
  (b) rule says 25 *qualified* IDs per leg; engine counts any ACTIVE id (even $0 stake)
Marked xfail so the suite stays green while the deviation stays visible.
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


def _leg_chain(prefix, root, side, count, stake):
    """Single-sided binary chain of `count` nodes hanging under `root` on `side`."""
    out = []
    parent, s = root, side
    for i in range(count):
        a = f"0x{prefix}{i:038x}"
        out.append(_u(a, sponsor=parent, bp=parent, side=s, stake=stake))
        parent, s = a, "left"
    return out


class TestMonthlyRuleEdges:
    def _network(self, direct_stake, leg_stake):
        root = "0x" + "1" * 40
        users = [_u(root, stake=1000)]
        # 10 directs (sponsor tree only)
        users += [_u(f"0xd{i:039x}", sponsor=root, stake=direct_stake) for i in range(10)]
        users += _leg_chain("a", root, "left", 25, leg_stake)
        users += _leg_chain("b", root, "right", 25, leg_stake)
        _, bd = tree_engine.compute(users, {"daily": 100, "weekly": 100, "monthly": 100}, NOW)
        return bd[root]

    @pytest.mark.xfail(reason="engine does not require Diamond rank for monthly qualification",
                       strict=True)
    def test_monthly_requires_diamond_rank(self):
        """10 directs x $200 = $2000 -> rank Gold, yet engine marks monthly_qualified."""
        bd = self._network(direct_stake=200, leg_stake=200)
        assert bd["rank"] == "Gold"
        assert bd["binary"]["left_business_usd"] >= 5000
        assert bd["monthly_qualified"] is False, \
            f"rank={bd['rank']} but monthly_qualified={bd['monthly_qualified']}"

    @pytest.mark.xfail(reason="leg IDs count any ACTIVE user, not only >=$50 qualified IDs",
                       strict=True)
    def test_leg_ids_should_count_only_qualified_ids(self):
        """25 leg IDs per leg staking only $1 each still counts as 25 IDs."""
        root = "0x" + "1" * 40
        users = [_u(root, stake=1000)]
        users += [_u(f"0xd{i:039x}", sponsor=root, stake=200) for i in range(10)]
        # 5 big + 20 dust nodes per leg -> $5000+ business but only 5 *qualified* IDs
        for prefix, side in (("a", "left"), ("b", "right")):
            users += _leg_chain(prefix, root, side, 5, 1000)
            users += _leg_chain(prefix + "f", f"0x{prefix}{4:038x}", "right", 20, 1)
        _, bd = tree_engine.compute(users, {"daily": 0, "weekly": 0, "monthly": 0}, NOW)
        b = bd[root]
        assert b["binary"]["left_ids"] >= 25
        assert b["monthly_qualified"] is False, "only 5 qualified ($50+) IDs per leg"
