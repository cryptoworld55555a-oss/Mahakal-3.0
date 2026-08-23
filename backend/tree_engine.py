"""TITAN Referral Tree Engine.

Walks the REAL referral network (sponsor edges) and the BINARY tree (sponsor-chosen
left/right placement) and computes each user's cumulative USD reward entitlement, then emits
Merkle leaves consumed by merkle.build(). ALL rewards (ROI, level, daily, weekly, monthly)
are claimed as TTN bought live from PancakeSwap into the user's wallet.

Cap RULE: CLAIM never touches the mining cap. The mining cap is reduced ONLY when the user
SELLS TTN -> USDT, by the ACTUAL USDT received at the live price. (The capReduce bool on a
leaf now only separates two cumulative reward streams; it no longer affects the cap.)

Binary is used ONLY for qualification (no matching income). Monthly qualification =
active + own stake >= $50 + 10 active directs (>= $50 each) + $2000 direct business +
25 qualified IDs each leg + $5000 business each leg. Both legs counted only 15 levels deep.
A one-time qualification grants Owner-Club (300% cap) permanently.

Pure calculation. Produces (address, cumulative_usd_wei, cap_reduce) leaves + per-user breakdown.
"""
from collections import defaultdict
from datetime import datetime, timezone
from typing import List, Dict, Tuple
import reward_engine as rw

BPS = 10000
MIN_MEMBERSHIP_USD = 50.0
MONTHLY_MIN_DIRECTS = 10
MONTHLY_DIRECT_BUSINESS = 2000.0
MONTHLY_LEG_IDS = 25
MONTHLY_LEG_BUSINESS = 5000.0
MAX_DEPTH = 15


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

    # ------------------------------------------------ Sponsor tree (level income + rank)
    children = defaultdict(list)
    for u in users:
        sp = (u.get("sponsor") or "").lower()
        if sp and sp in by_addr:
            children[sp].append(u["address"].lower())

    direct_business = defaultdict(float)
    active_directs = defaultdict(int)
    qualified_directs = defaultdict(int)   # active directs with own stake >= $50
    for sp, kids in children.items():
        for k in kids:
            ku = by_addr[k]
            if ku.get("active"):
                stake = float(ku.get("stake_usd", 0))
                direct_business[sp] += stake
                active_directs[sp] += 1
                if stake >= MIN_MEMBERSHIP_USD:
                    qualified_directs[sp] += 1

    # 15-level team business (sum of active downline stakes within MAX_DEPTH) -> Diamond gate.
    team_business = defaultdict(float)
    for u in users:
        s = float(u.get("stake_usd", 0))
        if s <= 0 or not u.get("active"):
            continue
        anc_addr = (u.get("sponsor") or "").lower()
        lvl = 1
        while anc_addr and anc_addr in by_addr and lvl <= MAX_DEPTH:
            team_business[anc_addr] += s
            anc_addr = (by_addr[anc_addr].get("sponsor") or "").lower()
            lvl += 1

    rank = {a: rw.rank_for(active_directs[a], direct_business[a], team_business[a]) for a in by_addr}

    # Level income: for each staking user, credit uplines L1..L15 (rank-gated, active-gated)
    level_income = defaultdict(float)
    level_lapsed = defaultdict(float)
    for u in users:
        s = float(u.get("stake_usd", 0))
        if s <= 0:
            continue
        anc_addr = (u.get("sponsor") or "").lower()
        lvl = 1
        while anc_addr and anc_addr in by_addr and lvl <= MAX_DEPTH:
            amt = s * rw.LEVEL_BPS[lvl - 1] / BPS
            anc = by_addr[anc_addr]
            if lvl <= rank[anc_addr]["max_level"] and anc.get("active"):
                level_income[anc_addr] += amt
            else:
                level_lapsed[anc_addr] += amt
            anc_addr = (anc.get("sponsor") or "").lower()
            lvl += 1

    # ------------------------------------------------ Binary tree (qualification only)
    bchild = defaultdict(lambda: {"left": None, "right": None})
    for u in users:
        bp = (u.get("binary_parent") or "").lower()
        side = u.get("binary_side")
        if bp and bp in by_addr and side in ("left", "right"):
            bchild[bp][side] = u["address"].lower()

    def leg_stats(start_addr):
        """Qualified active IDs (own stake >= $50) + business in a binary leg, MAX_DEPTH deep."""
        ids, biz = 0, 0.0
        stack = [(start_addr, 1)]
        while stack:
            a, depth = stack.pop()
            if not a or depth > MAX_DEPTH or a not in by_addr:
                continue
            u = by_addr[a]
            if u.get("active"):
                stake = float(u.get("stake_usd", 0))
                if stake >= MIN_MEMBERSHIP_USD:
                    ids += 1          # count only $50+ QUALIFIED IDs (not dust actives)
                biz += stake
            ch = bchild[a]
            stack.append((ch["left"], depth + 1))
            stack.append((ch["right"], depth + 1))
        return ids, biz

    left_ids = {}; right_ids = {}; left_biz = {}; right_biz = {}
    for a in by_addr:
        li, lb = leg_stats(bchild[a]["left"])
        ri, rb = leg_stats(bchild[a]["right"])
        left_ids[a], left_biz[a] = li, lb
        right_ids[a], right_biz[a] = ri, rb

    # Monthly qualification (this period)
    monthly_qualified = {}
    for a in by_addr:
        u = by_addr[a]
        monthly_qualified[a] = bool(
            u.get("active")
            and float(u.get("stake_usd", 0)) >= MIN_MEMBERSHIP_USD
            and qualified_directs[a] >= MONTHLY_MIN_DIRECTS
            and direct_business[a] >= MONTHLY_DIRECT_BUSINESS
            and left_ids[a] >= MONTHLY_LEG_IDS and right_ids[a] >= MONTHLY_LEG_IDS
            and left_biz[a] >= MONTHLY_LEG_BUSINESS and right_biz[a] >= MONTHLY_LEG_BUSINESS
        )

    # ------------------------------------------------ Self ROI + caps
    self_roi = {}; caps = {}
    for u in users:
        a = u["address"].lower()
        cap = rw.cap_for(float(u.get("stake_usd", 0)), bool(u.get("owner_tier")))
        caps[a] = cap
        days = _days_since(u.get("activated_at"), now)
        self_roi[a] = min(cap, days * cap * rw.DAILY_ROI_BPS / BPS)

    # ------------------------------------------------ Pools
    # Pool eligibility (exact rules): daily = 1 active direct($50+) + cap>=$100;
    # weekly = 5 active directs($50+) + cap>=$200; monthly = full binary qualification.
    active_set = {a for a in by_addr if by_addr[a].get("active")}
    daily_elig = {a for a in active_set if qualified_directs[a] >= 1 and caps[a] >= 100}
    weekly_elig = {a for a in active_set if qualified_directs[a] >= 5 and caps[a] >= 200}
    achievers = {a for a in active_set if monthly_qualified[a]}
    daily_share = pools.get("daily", 0) / len(daily_elig) if daily_elig else 0
    weekly_share = pools.get("weekly", 0) / len(weekly_elig) if weekly_elig else 0
    monthly_share = pools.get("monthly", 0) / len(achievers) if achievers else 0

    # ------------------------------------------------ Leaves + breakdown
    leaves = []; breakdown = {}
    for a in by_addr:
        m_share = monthly_share if a in achievers else 0
        d_share = daily_share if a in daily_elig else 0
        w_share = weekly_share if a in weekly_elig else 0

        # Two cumulative reward streams (cap is NOT touched at claim; only at sell).
        # streamA = self ROI + level income + monthly pool; streamB = daily + weekly pool.
        stream_a = self_roi[a] + level_income[a] + m_share
        stream_b = d_share + w_share

        breakdown[a] = {
            "address": a,
            "rank": rank[a]["name"],
            "mining_cap_usd": round(caps[a], 6),
            "owner_tier": bool(by_addr[a].get("owner_tier")),
            "active_directs": active_directs[a],
            "qualified_directs": qualified_directs[a],
            "direct_business_usd": round(direct_business[a], 6),
            "team_business_usd": round(team_business[a], 6),
            "self_roi_usd": round(self_roi[a], 6),
            "level_income_usd": round(level_income[a], 6),
            "level_lapsed_usd": round(level_lapsed[a], 6),
            "binary": {
                "left_ids": left_ids[a], "right_ids": right_ids[a],
                "left_business_usd": round(left_biz[a], 6), "right_business_usd": round(right_biz[a], 6),
            },
            "monthly_qualified": monthly_qualified[a],
            "daily_eligible": a in daily_elig,
            "weekly_eligible": a in weekly_elig,
            "daily_pool_usd": round(d_share, 6),
            "weekly_pool_usd": round(w_share, 6),
            "monthly_pool_usd": round(m_share, 6),
            "claimable_stream_a_usd": round(stream_a, 6),
            "claimable_stream_b_usd": round(stream_b, 6),
            "total_claimable_usd": round(stream_a + stream_b, 6),
        }
        if stream_a > 0:
            leaves.append((a, int(round(stream_a * 1e18)), True))
        if stream_b > 0:
            leaves.append((a, int(round(stream_b * 1e18)), False))

    return leaves, breakdown
