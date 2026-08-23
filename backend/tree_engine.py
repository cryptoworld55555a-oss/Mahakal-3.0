"""TITAN Referral Tree Engine.

Walks the REAL referral network (sponsor edges) and computes each user's cumulative
USD entitlement, then emits Merkle leaves consumed by merkle.build():
  - Self ROI      : 0.5%/day of mining cap, capped at cap                     -> non-reducing bucket
  - Level income  : 25% cascade up 15 uplines, gated by each upline's rank    -> cap-reducing bucket
  - Daily pool    : shared among active users                                 -> non-reducing bucket
  - Weekly pool   : shared among rank >= Silver                               -> non-reducing bucket
  - Monthly pool  : shared among Owner-Club (300x) members                    -> cap-reducing bucket

Pure calculation. Produces (address, cumulative_usd, cap_reduce) leaves + a per-user breakdown.
"""
from collections import defaultdict
from datetime import datetime, timezone
from typing import List, Dict, Tuple
import reward_engine as rw

BPS = 10000


def _days_since(iso: str, now: datetime) -> int:
    if not iso:
        return 0
    try:
        dt = datetime.fromisoformat(iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
    except Exception:
        return 0
    return max(0, (now - dt).days)


def compute(users: List[dict], pools: Dict[str, float], now: datetime = None) -> Tuple[List[Tuple[str, int, bool]], Dict[str, dict]]:
    now = now or datetime.now(timezone.utc)
    by_addr = {u["address"].lower(): u for u in users}

    children = defaultdict(list)
    for u in users:
        sp = (u.get("sponsor") or "").lower()
        if sp and sp in by_addr:
            children[sp].append(u["address"].lower())

    # Direct business + active directs (for rank)
    direct_business = defaultdict(float)
    active_directs = defaultdict(int)
    for sp, kids in children.items():
        for k in kids:
            ku = by_addr[k]
            if ku.get("active"):
                direct_business[sp] += float(ku.get("stake_usd", 0))
                active_directs[sp] += 1

    rank = {a: rw.rank_for(active_directs[a], direct_business[a]) for a in by_addr}

    # Level income: for each staking user, credit uplines L1..L15 (rank-gated, active-gated)
    level_income = defaultdict(float)
    level_lapsed = defaultdict(float)
    for u in users:
        s = float(u.get("stake_usd", 0))
        if s <= 0:
            continue
        anc_addr = (u.get("sponsor") or "").lower()
        lvl = 1
        while anc_addr and anc_addr in by_addr and lvl <= 15:
            amt = s * rw.LEVEL_BPS[lvl - 1] / BPS
            anc = by_addr[anc_addr]
            if lvl <= rank[anc_addr]["max_level"] and anc.get("active"):
                level_income[anc_addr] += amt
            else:
                level_lapsed[anc_addr] += amt
            anc_addr = (anc.get("sponsor") or "").lower()
            lvl += 1

    # Self ROI (0.5%/day of cap, capped at cap)
    self_roi = {}
    caps = {}
    for u in users:
        a = u["address"].lower()
        cap = rw.cap_for(float(u.get("stake_usd", 0)), bool(u.get("owner_tier")))
        caps[a] = cap
        days = _days_since(u.get("activated_at"), now)
        self_roi[a] = min(cap, days * cap * rw.DAILY_ROI_BPS / BPS)

    # Pool eligibility
    active_set = {a for a in by_addr if by_addr[a].get("active")}
    silver_plus = {a for a in active_set if rank[a]["max_level"] >= 6}
    owner_club = {a for a in active_set if by_addr[a].get("owner_tier")}
    daily_share = pools.get("daily", 0) / len(active_set) if active_set else 0
    weekly_share = pools.get("weekly", 0) / len(silver_plus) if silver_plus else 0
    monthly_share = pools.get("monthly", 0) / len(owner_club) if owner_club else 0

    leaves = []
    breakdown = {}
    for a in by_addr:
        m_share = monthly_share if a in owner_club else 0
        d_share = daily_share if a in active_set else 0
        w_share = weekly_share if a in silver_plus else 0

        reducing = level_income[a] + m_share
        reducing = min(reducing, caps[a])  # never exceed mining cap
        non_reducing = self_roi[a] + d_share + w_share

        breakdown[a] = {
            "address": a,
            "rank": rank[a]["name"],
            "mining_cap_usd": round(caps[a], 6),
            "active_directs": active_directs[a],
            "direct_business_usd": round(direct_business[a], 6),
            "self_roi_usd": round(self_roi[a], 6),
            "level_income_usd": round(level_income[a], 6),
            "level_lapsed_usd": round(level_lapsed[a], 6),
            "daily_pool_usd": round(d_share, 6),
            "weekly_pool_usd": round(w_share, 6),
            "monthly_pool_usd": round(m_share, 6),
            "cumulative_reducing_usd": round(reducing, 6),
            "cumulative_nonreducing_usd": round(non_reducing, 6),
        }
        if reducing > 0:
            leaves.append((a, int(round(reducing * 1e18)), True))
        if non_reducing > 0:
            leaves.append((a, int(round(non_reducing * 1e18)), False))

    return leaves, breakdown
