"""TITAN off-chain Reward Engine (calculation brain).
Pure, config-driven calculations. Does NOT hold/move funds — output is later
authorized on-chain (Merkle/signature). Percentages match Rule Book 5.0.
"""
from typing import List, Dict

# 25% level income (basis points of a downline's stake), L1..L15
LEVEL_BPS = [700, 300, 300, 200, 200, 200, 100, 100, 100, 50, 50, 50, 50, 50, 50]  # sum = 2500 = 25%
DAILY_ROI_BPS = 50            # 0.5% daily generation of cap
STANDARD_CAP_BPS = 20000      # 200%
OWNER_CAP_BPS = 30000         # 300%
DAILY_POOL_BPS = 500          # 5% of activation to daily pool
WEEKLY_POOL_BPS = 500         # 5% to weekly pool
MONTHLY_DEDUCT_BPS = 1000     # 10% of daily+weekly payout -> monthly pool
BPS = 10000

# Rank -> highest level unlocked. Thresholds match AETHERA leadership ladder.
# Star=L2-3 (5 directs), Silver=L4-6 (5 directs+$1000), Gold=L7-9 (10 directs+$2000),
# Diamond=L10-15 (10 directs + $2000 direct biz + $5000 15-level team business).
RANKS = [
    {"name": "Active",  "max_level": 1,  "directs": 0,  "direct_business": 0,    "team_business": 0},
    {"name": "Star",    "max_level": 3,  "directs": 5,  "direct_business": 0,    "team_business": 0},
    {"name": "Silver",  "max_level": 6,  "directs": 5,  "direct_business": 1000, "team_business": 0},
    {"name": "Gold",    "max_level": 9,  "directs": 10, "direct_business": 2000, "team_business": 0},
    {"name": "Diamond", "max_level": 15, "directs": 10, "direct_business": 2000, "team_business": 5000},
]


def cap_for(stake_usd: float, owner: bool = False) -> float:
    return stake_usd * (OWNER_CAP_BPS if owner else STANDARD_CAP_BPS) / BPS


def daily_roi(available_cap_usd: float) -> float:
    """Self ROI: 0.5% daily of available mining cap (reduces cap only on sell)."""
    return available_cap_usd * DAILY_ROI_BPS / BPS


def rank_for(active_directs: int, direct_business_usd: float, team_business_usd: float = 0.0) -> Dict:
    achieved = RANKS[0]
    for r in RANKS:
        if (active_directs >= r["directs"]
                and direct_business_usd >= r["direct_business"]
                and team_business_usd >= r["team_business"]):
            achieved = r
    return achieved


def level_income(downline_stake_usd: float, upline_max_level: int) -> List[Dict]:
    """Distribute 25% of a downline's stake up the tree, gated by each upline's rank.
    upline_max_level = the rank-unlocked max level for THIS calc's viewer (simplified per-upline)."""
    out = []
    for lvl in range(1, 16):
        bps = LEVEL_BPS[lvl - 1]
        amount = downline_stake_usd * bps / BPS
        unlocked = lvl <= upline_max_level
        out.append({
            "level": lvl,
            "pct": bps / 100.0,
            "amount_usd": round(amount, 6),
            "unlocked": unlocked,
            "payable_usd": round(amount if unlocked else 0.0, 6),
            "lapsed_usd": round(0.0 if unlocked else amount, 6),
        })
    return out


def pool_contribution(stake_usd: float) -> Dict:
    daily = stake_usd * DAILY_POOL_BPS / BPS
    weekly = stake_usd * WEEKLY_POOL_BPS / BPS
    # monthly = 10% deduction from daily+weekly payouts
    monthly = (daily + weekly) * MONTHLY_DEDUCT_BPS / BPS
    return {
        "daily_pool_usd": round(daily, 6),
        "weekly_pool_usd": round(weekly, 6),
        "daily_net_usd": round(daily - daily * MONTHLY_DEDUCT_BPS / BPS, 6),
        "weekly_net_usd": round(weekly - weekly * MONTHLY_DEDUCT_BPS / BPS, 6),
        "monthly_pool_usd": round(monthly, 6),
    }


def monthly_owner_qualified(active_directs, direct_business, left_ids, right_ids,
                            left_carry, right_carry, team_business=0.0) -> bool:
    """Diamond + $5000 both legs + 25 IDs each leg -> 300% cap Owner Club.
    Diamond rank itself needs 10 directs + $2000 direct + $5000 15-level team business."""
    return (rank_for(active_directs, direct_business, team_business)["name"] == "Diamond"
            and left_ids >= 25 and right_ids >= 25
            and left_carry >= 5000 and right_carry >= 5000)


def simulate(stake_usd: float, owner: bool, active_directs: int, direct_business: float,
             downline_stake_usd: float, team_business: float = 0.0) -> Dict:
    r = rank_for(active_directs, direct_business, team_business)
    cap = cap_for(stake_usd, owner)
    return {
        "stake_usd": stake_usd,
        "owner_tier": owner,
        "rank": r["name"],
        "mining_cap_usd": round(cap, 6),
        "self_daily_roi_usd": round(daily_roi(cap), 6),
        "roi_days_to_full": round(cap / daily_roi(cap)) if daily_roi(cap) else 0,
        "level_income": level_income(downline_stake_usd, r["max_level"]),
        "pools_from_this_stake": pool_contribution(stake_usd),
    }
