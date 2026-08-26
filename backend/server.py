from fastapi import FastAPI, APIRouter, HTTPException, Query, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import uuid
import random
from datetime import datetime, timezone, timedelta

from eth_account import Account
from eth_account.messages import encode_defunct

import reward_engine as rw
import merkle
import tree_engine
import onchain
import re as _re
from pydantic import field_validator

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="TITAN (TTN) API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ----------------------------- Config -----------------------------
CHAIN_ID = int(os.environ.get('CHAIN_ID', '97'))
TOTAL_SUPPLY = float(os.environ.get('TOTAL_SUPPLY', '200000'))
TOKEN_PRICE_USD = float(os.environ.get('TOKEN_PRICE_USD', '10'))
PRICE_SPARK = [9.12, 9.28, 9.19, 9.44, 9.61, 9.55, 9.82, 9.97, 9.9, 10.14, 10.03, 10.0]

CONTRACTS = {
    "token": os.environ.get('TOKEN_ADDRESS', '0x0000000000000000000000000000000000000000'),
    "main_protocol": os.environ.get('MAIN_PROTOCOL_ADDRESS', '0x0000000000000000000000000000000000000000'),
    "reward_engine": os.environ.get('REWARD_ENGINE_ADDRESS', '0x0000000000000000000000000000000000000000'),
    "pool_manager": os.environ.get('POOL_MANAGER_ADDRESS', '0x0000000000000000000000000000000000000000'),
    "community_fund": os.environ.get('COMMUNITY_FUND_ADDRESS', '0x0000000000000000000000000000000000000000'),
}

TOKEN_SPEC = {
    "name": "Titan",
    "symbol": "TTN",
    "decimals": 18,
    "total_supply": TOTAL_SUPPLY,
    "chain": "BNB Smart Chain",
    "standard": "BEP-20",
}

# Seed values for the protocol ledger (Module 1 foundation - config driven).
DEFAULT_STATS = {
    "_id": "protocol",
    "creator_balance_usdt": 0.0,
    "daily_pool_usdt": 0.0,
    "weekly_pool_usdt": 0.0,
    "monthly_pool_usdt": 0.0,
    "community_fund_usdt": 0.0,
    "level_income_pool_usdt": 0.0,
    "ttn_stake_usdt": 0.0,
    "total_supply_ttn": TOTAL_SUPPLY,
    "updated_at": datetime.now(timezone.utc).isoformat(),
}


# ----------------------------- Models -----------------------------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    address: str
    uid: str
    is_active: bool = False
    activated_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_seen: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class NonceResponse(BaseModel):
    nonce: str
    chain_id: int


class VerifyRequest(BaseModel):
    address: str
    signature: str
    message: str
    ref: Optional[str] = None   # sponsor uid (TTN1xxxxx) or sponsor address
    leg: Optional[str] = None   # binary leg: "left" or "right"


class ActivateRequest(BaseModel):
    address: str
    amount: float = Field(gt=0)


# ----------------------------- Helpers -----------------------------
async def _next_uid() -> str:
    doc = await db.counters.find_one_and_update(
        {"_id": "uid"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = doc["seq"] if doc and "seq" in doc else 1
    return f"TTN{100000 + seq}"


async def _resolve_sponsor(ref: Optional[str], self_addr: str) -> Optional[str]:
    """Resolve a referral code (uid TTN1xxxxx or wallet address) to a sponsor address."""
    if not ref:
        return None
    ref = ref.strip()
    sp = None
    if ref.lower().startswith("0x") and len(ref) == 42:
        sp = await db.users.find_one({"address": ref.lower()})
    else:
        sp = await db.users.find_one({"uid": ref.upper()})
    if not sp:
        return None
    if sp["address"].lower() == self_addr.lower():
        return None  # cannot sponsor self
    return sp["address"].lower()


async def _place_binary(sponsor_addr: str, leg: str):
    """Binary placement with spillover: walk DOWN the chosen leg from the sponsor
    until an empty slot is found. Returns (binary_parent, binary_side)."""
    if leg not in ("left", "right"):
        leg = "left"
    current = sponsor_addr
    for _ in range(5000):  # safety bound against cycles
        child = await db.users.find_one({"binary_parent": current, "binary_side": leg})
        if not child:
            return current, leg
        current = child["address"].lower()
    return sponsor_addr, leg


def _public_user(doc: dict) -> dict:
    return {
        "address": doc["address"],
        "uid": doc["uid"],
        "is_active": doc.get("is_active", False),
        "activated_at": doc.get("activated_at"),
        "total_deposited": doc.get("total_deposited", 0),
        "sponsor": doc.get("sponsor"),
        "created_at": doc.get("created_at"),
    }


def _pool_resets():
    now = datetime.now(timezone.utc)
    daily = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    days_ahead = (7 - now.weekday()) % 7 or 7
    weekly = (now + timedelta(days=days_ahead)).replace(hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        monthly = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        monthly = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return {"daily": daily.isoformat(), "weekly": weekly.isoformat(), "monthly": monthly.isoformat()}


def _cycle_ids(now: datetime) -> dict:
    """The identifier of the currently-OPEN (accumulating) cycle for each pool."""
    iso = now.isocalendar()
    return {
        "daily": now.strftime("%Y-%m-%d"),
        "weekly": f"{iso[0]}-W{iso[1]:02d}",
        "monthly": now.strftime("%Y-%m"),
    }


async def _settle_due_pools():
    """Cycle settlement: when a pool's countdown ends (its cycle id advances), FREEZE the
    current qualifiers + pool balance, split it EQUALLY (daily/weekly: net 90%, the 10% moves
    to the monthly Owner pool; monthly: full split), credit each qualifier's cumulative
    `settled_*_usd`, then RESET the pool to 0 for the next cycle. Idempotent per cycle.
    Returns True if anything was settled (caller should rebuild the snapshot)."""
    now = datetime.now(timezone.utc)
    cur = _cycle_ids(now)
    state = await db.pool_state.find_one({"_id": "cycles"})
    if not state:
        # First run: start tracking the current open cycles, settle nothing yet.
        await db.pool_state.insert_one({"_id": "cycles", **{f"{p}_open": cur[p] for p in cur}})
        return False

    snap = await db.reward_snapshots.find_one({"_id": "latest"}) or {}
    breakdown = snap.get("breakdown") or {}
    stats = await db.protocol_stats.find_one({"_id": "protocol"}) or {}
    qual_key = {"daily": "daily_eligible", "weekly": "weekly_eligible", "monthly": "monthly_qualified"}
    balance_key = {"daily": "daily_pool_usdt", "weekly": "weekly_pool_usdt", "monthly": "monthly_pool_usdt"}
    settled_field = {"daily": "settled_daily_usd", "weekly": "settled_weekly_usd", "monthly": "settled_monthly_usd"}

    changed = False
    updates = {}
    for pool in ("daily", "weekly", "monthly"):
        open_cycle = state.get(f"{pool}_open")
        if open_cycle is None:
            updates[f"{pool}_open"] = cur[pool]
            continue
        if cur[pool] == open_cycle:
            continue  # still inside the same cycle, nothing to settle

        # --- The previous cycle just closed: settle it ---
        balance = float(stats.get(balance_key[pool], 0) or 0)
        qualifiers = [a for a, bd in breakdown.items() if bd.get(qual_key[pool])]
        if balance > 0 and qualifiers:
            if pool == "monthly":
                per = balance / len(qualifiers)  # no further deduction
                for a in qualifiers:
                    await db.users.update_one({"address": a}, {"$inc": {settled_field[pool]: round(per, 6)}})
            else:
                gross_per = balance / len(qualifiers)
                net_per = gross_per * 0.9          # recipient gets 90%
                deduct_total = balance * 0.1       # 10% funds the monthly Owner pool
                for a in qualifiers:
                    await db.users.update_one({"address": a}, {"$inc": {settled_field[pool]: round(net_per, 6)}})
                # Move the 10% deduction into the (accumulating) monthly pool.
                await db.protocol_stats.update_one({"_id": "protocol"}, {"$inc": {"monthly_pool_usdt": round(deduct_total, 6)}})
                stats["monthly_pool_usdt"] = float(stats.get("monthly_pool_usdt", 0) or 0) + deduct_total
            # Reset this pool for the next cycle.
            await db.protocol_stats.update_one({"_id": "protocol"}, {"$set": {balance_key[pool]: 0.0}})
            stats[balance_key[pool]] = 0.0
            # Record the closed cycle for history.
            await db.pool_settlements.insert_one({
                "pool": pool, "cycle": open_cycle, "closed_at": now.isoformat(),
                "pool_total": round(balance, 6), "qualifiers": len(qualifiers),
            })
            changed = True
        elif pool != "monthly" and balance > 0:
            # No qualifiers this daily/weekly cycle -> carry the whole balance into the monthly pool.
            await db.protocol_stats.update_one({"_id": "protocol"}, {"$inc": {"monthly_pool_usdt": round(balance, 6)}, "$set": {balance_key[pool]: 0.0}})
            stats["monthly_pool_usdt"] = float(stats.get("monthly_pool_usdt", 0) or 0) + balance
            stats[balance_key[pool]] = 0.0
            changed = True

        updates[f"{pool}_open"] = cur[pool]

    if updates:
        await db.pool_state.update_one({"_id": "cycles"}, {"$set": updates})
    return changed



# ----------------------------- Routes -----------------------------
@api_router.get("/")
async def root():
    return {"message": "TITAN (TTN) API", "chain_id": CHAIN_ID}


@api_router.get("/health")
async def health():
    await db.command("ping")
    return {"ok": True, "chain_id": CHAIN_ID}


@api_router.get("/config")
async def get_config():
    return {"chain_id": CHAIN_ID, "token": TOKEN_SPEC, "contracts": CONTRACTS}


@api_router.get("/auth/nonce", response_model=NonceResponse)
async def get_nonce(address: str = Query(...)):
    addr = address.lower()
    value = secrets.token_urlsafe(24)
    await db.nonces.update_one(
        {"_id": addr},
        {"$set": {"value": value, "expires": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()}},
        upsert=True,
    )
    return NonceResponse(nonce=value, chain_id=CHAIN_ID)


@api_router.post("/auth/verify")
async def verify(body: VerifyRequest):
    addr = body.address.lower()
    saved = await db.nonces.find_one({"_id": addr})
    if not saved:
        raise HTTPException(status_code=401, detail="Nonce missing. Request a new one.")
    if datetime.fromisoformat(saved["expires"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Nonce expired.")
    if saved["value"] not in body.message or f"Chain ID: {CHAIN_ID}" not in body.message:
        raise HTTPException(status_code=401, detail="Invalid sign-in message.")
    try:
        recovered = Account.recover_message(encode_defunct(text=body.message), signature=body.signature)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid signature.")
    if recovered.lower() != addr:
        raise HTTPException(status_code=401, detail="Signature / address mismatch.")

    await db.nonces.delete_one({"_id": addr})  # one-time use

    existing = await db.users.find_one({"address": addr})
    now = datetime.now(timezone.utc).isoformat()
    if existing:
        await db.users.update_one({"address": addr}, {"$set": {"last_seen": now}})
        existing["last_seen"] = now
        return _public_user(existing)

    uid = await _next_uid()
    sponsor_addr = await _resolve_sponsor(body.ref, addr)
    if sponsor_addr is None:
        # Only the very first user (root/admin) may join without a referrer.
        # Everyone else MUST register through a valid referral link.
        total = await db.users.count_documents({})
        if total > 0:
            raise HTTPException(status_code=400, detail="A valid referral link is required to join. Please use a sponsor's referral link.")
    user = User(address=addr, uid=uid, last_seen=now)
    doc = user.model_dump()
    doc["sponsor"] = sponsor_addr
    # Binary tree placement (left/right) with spillover under the sponsor's chosen leg.
    if sponsor_addr is not None:
        bp, side = await _place_binary(sponsor_addr, body.leg or "left")
        doc["binary_parent"] = bp
        doc["binary_side"] = side
    await db.users.insert_one(doc)
    return _public_user(doc)


@api_router.get("/user/{address}")
async def get_user(address: str):
    doc = await db.users.find_one({"address": address.lower()})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return _public_user(doc)


MIN_ACTIVATION_USDT = 10.0


@api_router.post("/activate")
async def activate_id(body: ActivateRequest):
    """Demo/off-chain activation: simulate a USDT deposit and flip the ID Active.
    Real on-chain activation (MainProtocol.activate) replaces this after deploy."""
    if body.amount < MIN_ACTIVATION_USDT:
        raise HTTPException(status_code=400, detail="Minimum activation is $10 USDT")
    addr = body.address.lower()
    user = await db.users.find_one({"address": addr})
    if not user:
        raise HTTPException(status_code=404, detail="Connect your wallet first")

    now = datetime.now(timezone.utc).isoformat()

    # Idempotent: an already-Active ID is not re-charged in Module 1 demo mode.
    if user.get("is_active"):
        await db.users.update_one({"address": addr}, {"$set": {"last_seen": now}})
        return _public_user({**user, "last_seen": now})

    await db.users.update_one(
        {"address": addr},
        {
            "$set": {"is_active": True, "activated_at": user.get("activated_at") or now, "last_seen": now},
            "$inc": {"total_deposited": body.amount},
        },
    )

    amt = body.amount
    # Activation split (Rule Book 5.0) — always sums to 100%:
    #   60% TTN buy + auto-stake | 5% dev | 5% daily pool | 5% weekly pool | 25% level income
    #   Monthly pool is NOT funded from activation — it comes from 10% deduction on daily+weekly payouts.
    await db.protocol_stats.update_one(
        {"_id": "protocol"},
        {
            "$inc": {
                "ttn_stake_usdt": round(amt * 0.60, 6),          # 60% TTN buy + auto-stake
                "creator_balance_usdt": round(amt * 0.05, 6),    # 5% developer/creator
                "daily_pool_usdt": round(amt * 0.05, 6),         # 5% daily pool
                "weekly_pool_usdt": round(amt * 0.05, 6),        # 5% weekly pool
                "level_income_pool_usdt": round(amt * 0.25, 6),  # 25% level income allocation
            },
            "$set": {"updated_at": now},
        },
        upsert=True,
    )

    updated = await db.users.find_one({"address": addr})
    # Auto-refresh the reward snapshot so qualification (daily/weekly/etc.) reflects this stake immediately.
    try:
        await _rebuild_snapshot()
    except Exception as e:
        logging.warning(f"snapshot rebuild after activate failed: {e}")
    return _public_user(updated)


@api_router.get("/dashboard/stats")
async def dashboard_stats():
    if await _settle_due_pools():
        await _rebuild_snapshot()
    stats = await db.protocol_stats.find_one({"_id": "protocol"})
    if not stats:
        await db.protocol_stats.insert_one(DEFAULT_STATS.copy())
        stats = DEFAULT_STATS
    total_users = await db.users.count_documents({})
    total_activated = await db.users.count_documents({"is_active": True})

    # Real on-chain PancakeSwap pool state (falls back to "not live" before seeding).
    pool = onchain.get_pool_state()
    if pool.get("live"):
        live_price = pool["price_usd"]
        liquidity = {"usdt": pool["usdt"], "ttn": pool["ttn"], "value_usd": pool["value_usd"], "pair": pool["pair"]}
    else:
        live_price = None
        liquidity = {"usdt": 0.0, "ttn": 0.0, "value_usd": 0.0, "pair": "TTN/USDT · PancakeSwap V2"}

    daily = round(stats.get("daily_pool_usdt", 0.0) or 0.0, 2)
    weekly = round(stats.get("weekly_pool_usdt", 0.0) or 0.0, 2)
    # Monthly pool accrues 10% of the daily + weekly pools (Rule Book: 10% deduction -> Monthly).
    monthly = round((stats.get("monthly_pool_usdt", 0.0) or 0.0) + 0.10 * (daily + weekly), 2)

    # Real qualified counts from the latest reward snapshot (NOT total activated).
    snap = await db.reward_snapshots.find_one({"_id": "latest"}) or {}
    breakdown = snap.get("breakdown") or {}
    q_daily = sum(1 for b in breakdown.values() if b.get("daily_eligible"))
    q_weekly = sum(1 for b in breakdown.values() if b.get("weekly_eligible"))
    q_monthly = sum(1 for b in breakdown.values() if b.get("monthly_qualified"))

    def _share(bal, n):
        return round(bal / n, 2) if n > 0 else round(bal, 2)

    return {
        "creator_balance_usdt": round(stats.get("creator_balance_usdt", 0.0) or 0.0, 2),
        "pools": {"daily_usdt": daily, "weekly_usdt": weekly, "monthly_usdt": monthly},
        "pool_meta": {
            "daily": {"qualified_ids": q_daily, "sharing_usdt": _share(daily, q_daily)},
            "weekly": {"qualified_ids": q_weekly, "sharing_usdt": _share(weekly, q_weekly)},
            "monthly": {"qualified_ids": q_monthly, "sharing_usdt": _share(monthly, q_monthly)},
        },
        "community_fund_usdt": round(stats.get("community_fund_usdt", 0.0) or 0.0, 2),
        "level_income_pool_usdt": round(stats.get("level_income_pool_usdt", 0.0) or 0.0, 2),
        "ttn_stake_usdt": round(stats.get("ttn_stake_usdt", 0.0) or 0.0, 2),
        "total_supply_ttn": stats.get("total_supply_ttn", TOTAL_SUPPLY),
        "total_users": total_users,
        "total_activated_users": total_activated,
        "min_activation_usdt": MIN_ACTIVATION_USDT,
        "price_usd": live_price,
        "pool_live": bool(pool.get("live")),
        "liquidity": liquidity,
        "resets": _pool_resets(),
        "token": TOKEN_SPEC,
    }


def _mock_hash(seed: str) -> str:
    r = random.Random(seed)
    hexs = "0123456789abcdef"
    return "0x" + "".join(r.choice(hexs) for _ in range(64))


@api_router.get("/me/{address}")
async def me(address: str):
    addr = address.lower()
    doc = await db.users.find_one({"address": addr})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")

    active = doc.get("is_active", False)
    snap = await db.reward_snapshots.find_one({"_id": "latest"}) or {}
    bd = (snap.get("breakdown") or {}).get(addr, {})
    stake = float(doc.get("total_deposited", 0) or 0)
    cap = bd.get("mining_cap_usd", 0)
    reward = bd.get("total_claimable_usd", 0)
    roi = bd.get("self_roi_usd", 0)
    level_inc = bd.get("level_income_net_usd", bd.get("level_income_usd", 0))
    monthly = bd.get("monthly_pool_usd", 0)
    daily = bd.get("daily_pool_usd", 0)
    weekly = bd.get("weekly_pool_usd", 0)
    activity = [
        {
            "label": "Registration",
            "date": (doc.get("created_at") or "")[:10],
            "amount": "-",
            "hash": _mock_hash(addr + "reg"),
        }
    ]
    if active and doc.get("activated_at"):
        activity.insert(0, {
            "label": "Activation",
            "date": doc["activated_at"][:10],
            "amount": f"${doc.get('total_deposited', 0)}",
            "hash": _mock_hash(addr + "act"),
        })

    return {
        "uid": doc["uid"],
        "address": addr,
        "is_active": active,
        "status": "Active" if active else "Inactive",
        "referral_code": doc["uid"],
        "rank": bd.get("rank", "Active"),
        "monthly_qualified": bd.get("monthly_qualified", False),
        "stake_usdt": stake,
        "mining": {"available_cap_usdt": cap, "generated_reward_usdt": reward, "requires_usdt": 1.0},
        "holding": {"ttn": 0.0, "mined_value_usdt": reward, "current_value_usdt": 0.0, "appreciation_usdt": 0.0},
        "total_profit_usdt": reward,
        "profit_sources": [
            {"label": "ROI", "value": roi, "color": "#0AA84F"},
            {"label": "Daily", "value": daily, "color": "#65B82E"},
            {"label": "Weekly", "value": weekly, "color": "#D6C51E"},
            {"label": "Level", "value": level_inc, "color": "#FFA000"},
            {"label": "Monthly", "value": monthly, "color": "#12B76A"},
        ],
        "team": {"direct_reward_usdt": level_inc, "level_reward_usdt": level_inc},
        "recent_activity": activity,
    }


_DEMO_SPONSOR = "0xbfb8…8d90"


@api_router.get("/team/{address}")
async def team(address: str):
    addr = address.lower()
    doc = await db.users.find_one({"address": addr})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    active = doc.get("is_active", False)

    # Real data from the latest reward snapshot + live direct counts.
    snap = await db.reward_snapshots.find_one({"_id": "latest"}) or {}
    bd = (snap.get("breakdown") or {}).get(addr, {})
    binary = bd.get("binary", {})
    rank = bd.get("rank", "Active")
    adirects = bd.get("active_directs", 0)
    dbiz = bd.get("direct_business_usd", 0)
    tbiz = bd.get("team_business_usd", 0)
    lbiz = binary.get("left_business_usd", 0)
    rbiz = binary.get("right_business_usd", 0)
    lids = binary.get("left_ids", 0)
    rids = binary.get("right_ids", 0)

    # Direct referrals (live from DB)
    direct_docs = await db.users.find({"sponsor": addr}).to_list(2000)
    active_dir = sum(1 for u in direct_docs if u.get("is_active"))

    def unlocked(name):
        order = ["Active", "Star", "Silver", "Gold", "Diamond"]
        return order.index(rank) >= order.index(name)

    levels = [
        {"name": "Level 1", "sub": "Active membership", "tier": "level1", "unlocked": active,
         "status": "Active" if active else "Inactive", "reqs": []},
        {"name": "Star · Levels 2-3", "sub": "Active directs", "tier": "star", "unlocked": unlocked("Star"),
         "reqs": [{"label": "Active directs", "have": adirects, "need": 5}]},
        {"name": "Silver · Levels 4-6", "sub": "Active directs · Direct business", "tier": "silver", "unlocked": unlocked("Silver"),
         "reqs": [{"label": "Active directs", "have": adirects, "need": 5},
                  {"label": "Direct business", "have": dbiz, "need": 1000, "money": True}]},
        {"name": "Gold · Levels 7-9", "sub": "Active directs · Direct business", "tier": "gold", "unlocked": unlocked("Gold"),
         "reqs": [{"label": "Active directs", "have": adirects, "need": 10},
                  {"label": "Direct business", "have": dbiz, "need": 2000, "money": True}]},
        {"name": "Diamond · Levels 10-15", "sub": "Directs · Direct business · 15-level team business", "tier": "diamond", "unlocked": unlocked("Diamond"),
         "reqs": [{"label": "Active directs", "have": adirects, "need": 10},
                  {"label": "Direct business", "have": dbiz, "need": 2000, "money": True},
                  {"label": "15-level team business", "have": tbiz, "need": 5000, "money": True}]},
    ]
    unlocked_count = sum(1 for lv in levels if lv["unlocked"])
    levels_unlocked = {"Active": 1, "Star": 3, "Silver": 6, "Gold": 9, "Diamond": 15}.get(rank, 0) if active else 0
    return {
        "uid": doc["uid"],
        "address": addr,
        "referral_code": doc["uid"],
        "sponsor": doc.get("sponsor") or "—",
        "rank": rank,
        "monthly_qualified": bd.get("monthly_qualified", False),
        "structure": {
            "left": {"business_usdt": lbiz, "team_size": lids},
            "right": {"business_usdt": rbiz, "team_size": rids},
        },
        "directs": {"reward_usdt": bd.get("level_income_net_usd", bd.get("level_income_usd", 0)), "count": len(direct_docs),
                    "active": active_dir, "inactive": len(direct_docs) - active_dir},
        "level_summary": {"total_team_size": lids + rids, "total_team_business_usdt": lbiz + rbiz},
        "accounting": {"direct_level_rewards_usdt": bd.get("level_income_net_usd", bd.get("level_income_usd", 0)),
                       "lapsed_usdt": bd.get("level_lapsed_usd", 0)},
        "qualification": {"unlocked": levels_unlocked, "tiers_unlocked": unlocked_count, "total": 15, "levels": levels},
        "members": [{"uid": u.get("uid"), "address": u["address"], "active": u.get("is_active", False),
                     "stake_usdt": u.get("total_deposited", 0), "side": u.get("binary_side"), "level": 1}
                    for u in direct_docs[:50]],
        "total_members": len(direct_docs),
    }



def _gen_holders():
    r = random.Random(4242)
    hexs = "0123456789abcdef"
    holders = []
    val = 8.6
    for i in range(200):
        addr = "0x" + "".join(r.choice(hexs) for _ in range(4)) + "…" + "".join(r.choice(hexs) for _ in range(4))
        val = max(0.01, val - r.uniform(0.01, 0.08))
        holders.append({"address": addr, "ttn": round(val, 4)})
    return holders


_HOLDERS_CACHE = _gen_holders()


@api_router.get("/holders")
async def holders(search: str = "", page: int = 1, page_size: int = Query(25, ge=1, le=100)):
    query = {}
    if search:
        query = {"address": {"$regex": search.lower().replace("0x", "")}}
    users = await db.users.find(query).sort("total_deposited", -1).to_list(length=10000)
    addrs = [u.get("address", "") for u in users if u.get("address")]
    # Real on-chain TTN wallet balance for each user (what they hold after claiming).
    balances = await asyncio.gather(*[asyncio.to_thread(onchain.balance_of, a) for a in addrs[:300]])
    data = [{"address": a, "ttn": round(b, 4)} for a, b in zip(addrs, balances)]
    data.sort(key=lambda h: h["ttn"], reverse=True)
    total = len(data)
    pages = max(1, (total + page_size - 1) // page_size)
    page = max(1, min(page, pages))
    start = (page - 1) * page_size
    sliced = data[start:start + page_size]
    ranked = [{"rank": start + i + 1, **h} for i, h in enumerate(sliced)]
    return {"total": total, "page": page, "pages": pages, "page_size": page_size, "holders": ranked}


class RewardSimRequest(BaseModel):
    stake_usd: float = Field(gt=0)
    owner_tier: bool = False
    active_directs: int = Field(0, ge=0)
    direct_business_usd: float = Field(0.0, ge=0)
    downline_stake_usd: float = Field(0.0, ge=0)
    team_business_usd: float = Field(0.0, ge=0)


@api_router.post("/reward/simulate")
async def reward_simulate(req: RewardSimRequest):
    """Off-chain Reward Engine calculation (self ROI + level cascade + rank + pools + 300x tier).
    Output is calculation-only; on-chain authorization (Merkle) applied in next phase."""
    return rw.simulate(
        stake_usd=req.stake_usd,
        owner=req.owner_tier,
        active_directs=req.active_directs,
        direct_business=req.direct_business_usd,
        downline_stake_usd=req.downline_stake_usd,
        team_business=req.team_business_usd,
    )


class MonthlyQualRequest(BaseModel):
    active_directs: int = Field(0, ge=0)
    direct_business_usd: float = Field(0.0, ge=0)
    left_ids: int = Field(0, ge=0)
    right_ids: int = Field(0, ge=0)
    left_carry_usd: float = Field(0.0, ge=0)
    right_carry_usd: float = Field(0.0, ge=0)
    team_business_usd: float = Field(0.0, ge=0)


@api_router.post("/reward/monthly-qualify")
async def reward_monthly_qualify(req: MonthlyQualRequest):
    qualified = rw.monthly_owner_qualified(
        req.active_directs, req.direct_business_usd,
        req.left_ids, req.right_ids, req.left_carry_usd, req.right_carry_usd,
        team_business=req.team_business_usd)
    return {
        "owner_club_qualified": qualified,
        "cap_multiplier": "300%" if qualified else "200%",
        "rank": rw.rank_for(req.active_directs, req.direct_business_usd, req.team_business_usd)["name"],
    }


@api_router.get("/reward/config")
async def reward_config():
    return {
        "level_bps": rw.LEVEL_BPS,
        "level_pct": [b / 100.0 for b in rw.LEVEL_BPS],
        "total_level_pct": sum(rw.LEVEL_BPS) / 100.0,
        "daily_roi_pct": rw.DAILY_ROI_BPS / 100.0,
        "standard_cap_pct": rw.STANDARD_CAP_BPS / 100.0,
        "owner_cap_pct": rw.OWNER_CAP_BPS / 100.0,
        "ranks": rw.RANKS,
    }


class MerkleLeaf(BaseModel):
    address: str
    cumulative_usd: float = Field(ge=0)   # total lifetime USD entitlement
    category: int = Field(0, ge=0, le=4)  # 0=ROI 1=Level 2=Daily 3=Weekly 4=Monthly

    @field_validator("address")
    @classmethod
    def _valid_address(cls, v: str) -> str:
        if not _re.fullmatch(r"0x[0-9a-fA-F]{40}", v or ""):
            raise ValueError("invalid EVM address")
        return v


class MerkleBuildRequest(BaseModel):
    leaves: list[MerkleLeaf]


@api_router.post("/reward/merkle/build")
async def reward_merkle_build(req: MerkleBuildRequest):
    """Backend-as-calculator: turn per-user cumulative USD rewards into a Merkle root + proofs.
    Owner/multisig posts `root` on-chain via TitanProtocol.setMerkleRoot; each user claims their
    own leaf with `proof` via the category's named function (claimRoi/claimLevelIncome/
    claimDailyPool/claimWeeklyPool/claimMonthlyPool). Backend holds NO key that can move funds.
    USD is scaled to 18-decimal wei to match the on-chain leaf encoding (address,uint8,uint256)."""
    seen = set()
    for l in req.leaves:
        key = (l.address.lower(), l.category)
        if key in seen:
            raise HTTPException(status_code=422, detail=f"duplicate (address,category) leaf: {l.address}")
        seen.add(key)
    values = [(l.address, l.category, int(round(l.cumulative_usd * 1e18))) for l in req.leaves]
    result = merkle.build(values)
    await db.merkle_roots.insert_one({
        "root": result["root"],
        "leaf_count": len(values),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return result


@api_router.get("/reward/merkle/latest")
async def reward_merkle_latest():
    doc = await db.merkle_roots.find_one(sort=[("created_at", -1)])
    if not doc:
        return {"root": None, "leaf_count": 0}
    return {"root": doc["root"], "leaf_count": doc.get("leaf_count", 0), "created_at": doc.get("created_at")}


@api_router.get("/reward/root-status")
async def reward_root_status():
    """Compare the backend's current reward root (what user proofs are built against) with the
    root actually posted on the TitanProtocol contract. If they differ, claims will revert with
    'no root'/'bad proof' — the owner must Post Root On-chain from /admin."""
    snap = await db.reward_snapshots.find_one({"_id": "latest"}) or {}
    backend_root = snap.get("root")
    leaf_count = snap.get("leaf_count", 0)
    onchain_root = onchain.get_merkle_root()
    zero = "0x" + "0" * 64
    in_sync = bool(backend_root) and onchain_root.lower() == str(backend_root).lower()
    auto_poster = onchain.root_poster_address()          # backend hot wallet (from PK), or None
    onchain_poster = onchain.get_root_poster_onchain()   # currently authorized on contract
    auto_authorized = bool(auto_poster) and auto_poster.lower() == onchain_poster.lower()
    return {
        "backend_root": backend_root,
        "onchain_root": onchain_root,
        "onchain_set": onchain_root.lower() != zero,
        "in_sync": in_sync,
        "leaf_count": leaf_count,
        "auto_poster": auto_poster,
        "onchain_root_poster": onchain_poster,
        "auto_enabled": bool(auto_poster),
        "auto_authorized": auto_authorized,
    }


async def _load_network():
    """Read the real referral network from the DB into tree_engine input shape."""
    users = []
    async for u in db.users.find({}):
        users.append({
            "address": u["address"].lower(),
            "sponsor": (u.get("sponsor") or None),
            "binary_parent": (u.get("binary_parent") or None),
            "binary_side": u.get("binary_side"),
            "stake_usd": float(u.get("total_deposited", 0) or 0),
            "owner_tier": bool(u.get("owner_tier", False)),
            "active": bool(u.get("is_active", False)),
            "activated_at": u.get("activated_at"),
            "settled_daily_usd": float(u.get("settled_daily_usd", 0) or 0),
            "settled_weekly_usd": float(u.get("settled_weekly_usd", 0) or 0),
            "settled_monthly_usd": float(u.get("settled_monthly_usd", 0) or 0),
        })
    stats = await db.protocol_stats.find_one({"_id": "protocol"}) or {}
    pools = {
        "daily": float(stats.get("daily_pool_usdt", 0) or 0),
        "weekly": float(stats.get("weekly_pool_usdt", 0) or 0),
        "monthly": float(stats.get("monthly_pool_usdt", 0) or 0),
    }
    return users, pools


def _require_admin(x_admin_key: Optional[str]):
    """Light guard for admin/dev write endpoints. If ADMIN_API_KEY is set, it must match."""
    expected = os.environ.get("ADMIN_API_KEY")
    if expected and x_admin_key != expected:
        raise HTTPException(status_code=403, detail="admin key required")


async def _rebuild_snapshot():
    """Recompute the whole reward tree + Merkle root + proofs and persist as the latest snapshot.
    POOL rewards (daily/weekly/monthly) are CYCLE-GATED: the Merkle leaves for categories 2/3/4
    carry each user's SETTLED cumulative amount (credited only when a cycle closes), NOT the live
    running share. So pool rewards are NOT claimable on-chain until the countdown ends."""
    users, pools = await _load_network()
    leaves, breakdown = tree_engine.compute(users, pools)
    newly = [a for a, bd in breakdown.items() if bd.get("monthly_qualified") and not bd.get("owner_tier")]
    if newly:
        await db.users.update_many({"address": {"$in": newly}}, {"$set": {"owner_tier": True}})
        newly_set = set(newly)
        for u in users:
            if u["address"].lower() in newly_set:
                u["owner_tier"] = True
        leaves, breakdown = tree_engine.compute(users, pools)  # recompute with 300% caps applied

    # --- Cycle gate: swap live pool leaves (cat 2/3/4) for SETTLED cumulative amounts. ---
    settled = {u["address"].lower(): u for u in users}
    leaves = [(a, cat, wei) for (a, cat, wei) in leaves if cat not in (2, 3, 4)]
    for a, u in settled.items():
        sd = float(u.get("settled_daily_usd", 0) or 0)
        sw = float(u.get("settled_weekly_usd", 0) or 0)
        sm = float(u.get("settled_monthly_usd", 0) or 0)
        for amt, cat in ((sd, 2), (sw, 3), (sm, 4)):
            if amt > 0:
                leaves.append((a, cat, int(round(amt * 1e18))))
        if a in breakdown:
            bd = breakdown[a]
            bd["settled_daily_usd"] = round(sd, 6)
            bd["settled_weekly_usd"] = round(sw, 6)
            bd["settled_monthly_usd"] = round(sm, 6)
            # Claimable = self ROI + net level income + SETTLED pool rewards (not live pool shares).
            claimable = float(bd.get("self_roi_usd", 0)) + float(bd.get("level_income_net_usd", 0)) + sd + sw + sm
            bd["settled_claimable_usd"] = round(claimable, 6)

    result = merkle.build(leaves)
    snapshot = {
        "root": result["root"],
        "leaf_count": len(leaves),
        "user_count": len(users),
        "pools": pools,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.merkle_roots.insert_one({**snapshot})
    await db.reward_snapshots.replace_one(
        {"_id": "latest"},
        {"_id": "latest", **snapshot, "breakdown": breakdown},
        upsert=True,
    )
    await db.reward_proofs.delete_many({})
    grouped: dict = {}
    for p in result["proofs"]:
        grouped.setdefault(p["address"].lower(), []).append(p)
    if grouped:
        await db.reward_proofs.insert_many([
            {"_id": addr, "root": result["root"], "proofs": pfs} for addr, pfs in grouped.items()
        ])

    # AUTO-POST the new root on-chain (fully automatic claims — no manual /admin step).
    # Uses the limited ROOT POSTER hot wallet; only runs if BSC_ROOT_POSTER_PK is configured
    # and the on-chain root actually differs. Never blocks/raises out of the rebuild.
    if os.environ.get('BSC_ROOT_POSTER_PK'):
        try:
            current = onchain.get_merkle_root()
            if str(result["root"]).lower() != current.lower():
                loop = asyncio.get_event_loop()
                txh = await loop.run_in_executor(None, onchain.set_merkle_root_onchain, result["root"])
                logger.info(f"Auto-posted Merkle root {result['root']} tx={txh}")
        except Exception as e:
            logger.warning(f"Auto root-post skipped/failed: {e}")

    return {**snapshot, "proofs": result["proofs"]}


@api_router.post("/reward/tree/build")
async def reward_tree_build(x_admin_key: Optional[str] = Header(default=None)):
    """Walk the REAL referral tree, compute every user's entitlement, build Merkle root + proofs."""
    _require_admin(x_admin_key)
    return await _rebuild_snapshot()


@api_router.post("/reward/settle-due")
async def reward_settle_due(x_admin_key: Optional[str] = Header(default=None)):
    """Close any pool cycle whose countdown has ended: freeze qualifiers, split the pool equally,
    credit each qualifier's settled share, reset the pool, then rebuild the Merkle snapshot so the
    settled amounts become claimable on-chain. Idempotent — safe to run from a cron every minute."""
    _require_admin(x_admin_key)
    settled = await _settle_due_pools()
    if settled:
        await _rebuild_snapshot()
    return {"settled": settled}


@api_router.get("/reward/tree/user/{address}")
async def reward_tree_user(address: str):
    """A user's reward breakdown + the Merkle proof(s) they need to claim on-chain."""
    addr = address.lower()
    snap = await db.reward_snapshots.find_one({"_id": "latest"})
    if not snap:
        raise HTTPException(status_code=404, detail="No reward snapshot yet. Run /reward/tree/build.")
    bd = (snap.get("breakdown") or {}).get(addr)
    if not bd:
        raise HTTPException(status_code=404, detail="Address not in current reward tree")
    pdoc = await db.reward_proofs.find_one({"_id": addr})
    proofs = pdoc.get("proofs", []) if pdoc else []
    return {"root": snap["root"], "breakdown": bd, "proofs": proofs}


def _pool_claim(pool_key: str, settled_usd: float, resets: dict) -> dict:
    """Claim state for a pool. LOCKED while the cycle countdown runs; a user's frozen share
    (settled_usd) only becomes claimable AFTER the cycle closes and settlement credits it.
    unlock_at = next cycle close (the same countdown shown on the dashboard)."""
    unlock_at = resets.get(pool_key)
    now = datetime.now(timezone.utc)
    left = None
    if unlock_at:
        try:
            u = datetime.fromisoformat(unlock_at)
            if u.tzinfo is None:
                u = u.replace(tzinfo=timezone.utc)
            left = max(0, int((u - now).total_seconds()))
        except Exception:
            left = None
    return {
        "settled_usd": round(float(settled_usd or 0), 2),
        "open": float(settled_usd or 0) > 0,   # claimable only when a closed cycle credited a share
        "unlock_at": unlock_at,                 # next cycle close (countdown target)
        "seconds_left": left,
    }


@api_router.get("/pools/{address}")
async def pools_for_user(address: str):
    """Per-user pool qualification progress + live pool balances + on-chain achievers,
    computed from the latest reward snapshot (mirrors AETHERA's Reward Pools screen)."""
    addr = address.lower()
    # Close any cycle whose countdown has ended (freeze qualifiers + split + reset), then rebuild.
    if await _settle_due_pools():
        await _rebuild_snapshot()
    user_doc = await db.users.find_one({"address": addr}) or {}
    resets = _pool_resets()
    stats = await db.protocol_stats.find_one({"_id": "protocol"}) or {}
    snap = await db.reward_snapshots.find_one({"_id": "latest"}) or {}
    breakdown = snap.get("breakdown") or {}
    bd = breakdown.get(addr, {})

    # On-chain achievers = how many users currently qualify for each pool.
    daily_ach = sum(1 for b in breakdown.values() if b.get("daily_eligible"))
    weekly_ach = sum(1 for b in breakdown.values() if b.get("weekly_eligible"))
    monthly_ach = sum(1 for b in breakdown.values() if b.get("monthly_qualified"))

    daily_bal = round(float(stats.get("daily_pool_usdt", 0) or 0), 2)
    weekly_bal = round(float(stats.get("weekly_pool_usdt", 0) or 0), 2)
    # Monthly pool = base + 10% of the current daily + weekly pools (Rule Book: 10% deduction -> Monthly).
    monthly_bal = round(float(stats.get("monthly_pool_usdt", 0) or 0) + 0.10 * (daily_bal + weekly_bal), 2)

    q_directs = int(bd.get("qualified_directs", 0))
    cap = float(bd.get("mining_cap_usd", 0))
    dbiz = float(bd.get("direct_business_usd", 0))
    active_directs = int(bd.get("active_directs", 0))
    binr = bd.get("binary", {}) or {}
    left_ids = int(binr.get("left_ids", 0)); right_ids = int(binr.get("right_ids", 0))
    left_biz = float(binr.get("left_business_usd", 0)); right_biz = float(binr.get("right_business_usd", 0))
    in_tree = addr in breakdown

    NET = 0.9  # daily/weekly recipients get 90% (10% funds the monthly Owner pool)

    def est_net(balance, achievers, qualified):
        n = achievers + (0 if qualified else 1)
        return round((balance / n) * NET, 2) if n > 0 else round(balance * NET, 2)

    def est(balance, achievers, qualified):  # monthly: no further deduction
        n = achievers + (0 if qualified else 1)
        return round(balance / n, 2) if n > 0 else round(balance, 2)

    daily_q = bool(bd.get("daily_eligible"))
    weekly_q = bool(bd.get("weekly_eligible"))
    monthly_q = bool(bd.get("monthly_qualified"))
    settled_daily = float(user_doc.get("settled_daily_usd", 0) or 0)
    settled_weekly = float(user_doc.get("settled_weekly_usd", 0) or 0)
    settled_monthly = float(user_doc.get("settled_monthly_usd", 0) or 0)

    return {
        "in_tree": in_tree,
        "daily": {
            "balance": daily_bal, "achievers": daily_ach, "qualified": daily_q,
            "estimate": est_net(daily_bal, daily_ach, daily_q),
            "claim": _pool_claim("daily", settled_daily, resets),
            "reqs": [
                {"label": "Direct with 50+ Stake today", "have": q_directs, "need": 1, "ok": q_directs >= 1},
                {"label": "Available mining cap", "have": round(cap, 2), "need": 100, "ok": cap >= 100, "usd": True},
            ],
        },
        "weekly": {
            "balance": weekly_bal, "achievers": weekly_ach, "qualified": weekly_q,
            "estimate": est_net(weekly_bal, weekly_ach, weekly_q),
            "claim": _pool_claim("weekly", settled_weekly, resets),
            "reqs": [
                {"label": "Directs with 50+ Stake this week", "have": q_directs, "need": 5, "ok": q_directs >= 5},
                {"label": "Available mining cap", "have": round(cap, 2), "need": 200, "ok": cap >= 200, "usd": True},
            ],
        },
        "monthly": {
            "balance": monthly_bal, "achievers": monthly_ach, "qualified": monthly_q,
            "estimate": est(monthly_bal, monthly_ach, monthly_q),
            "claim": _pool_claim("monthly", settled_monthly, resets),
            "reqs": [
                {"label": "Active membership", "have": 1 if in_tree else 0, "need": 1, "ok": in_tree, "text": "Active"},
                {"label": "Active directs (min $50)", "have": active_directs, "need": 10, "ok": active_directs >= 10},
                {"label": "Direct business", "have": round(dbiz, 2), "need": 2000, "ok": dbiz >= 2000, "usd": True},
                {"label": "Left qualified IDs", "have": left_ids, "need": 25, "ok": left_ids >= 25},
                {"label": "Right qualified IDs", "have": right_ids, "need": 25, "ok": right_ids >= 25},
                {"label": "Left matching carry", "have": round(left_biz, 2), "need": 5000, "ok": left_biz >= 5000, "usd": True},
                {"label": "Right matching carry", "have": round(right_biz, 2), "need": 5000, "ok": right_biz >= 5000, "usd": True},
            ],
        },
    }



class SeedNode(BaseModel):
    uid: str
    sponsor_uid: Optional[str] = None
    stake_usd: float = 0
    active: bool = True
    owner_tier: bool = False
    days_active: int = 0


@api_router.post("/reward/tree/seed-demo")
async def reward_tree_seed_demo(x_admin_key: Optional[str] = Header(default=None)):
    """Wipe DEMO_* users and seed a binary network where DEMO_ROOT MONTHLY-QUALIFIES
    (10 directs + $2000 direct business + 25 IDs & $5000 business per binary leg)."""
    _require_admin(x_admin_key)
    await db.users.delete_many({"uid": {"$regex": "^DEMO"}})
    now = datetime.now(timezone.utc)

    nodes = []  # (uid, sponsor_uid, binary_parent_uid, side, stake, active, days)
    nodes.append(("DEMO_ROOT", None, None, None, 1000, True, 40))

    def build_leg(prefix, side_label):
        uids = [f"DEMO_{prefix}{i}" for i in range(25)]
        for i, uid in enumerate(uids):
            if i == 0:
                bparent, side = "DEMO_ROOT", side_label
            else:
                bparent = uids[(i - 1) // 2]
                side = "left" if i % 2 == 1 else "right"
            # First 8 of each leg are ROOT's direct sponsors (=> 16 directs, big direct business -> Diamond)
            sponsor = "DEMO_ROOT" if i < 8 else bparent
            nodes.append((uid, sponsor, bparent, side, 350, True, 12))
        return uids

    build_leg("L", "left")
    build_leg("R", "right")

    addr_of = {n[0]: "0x" + f"{(i + 1):040x}" for i, n in enumerate(nodes)}
    for uid, sp, bp, side, stake, active, days in nodes:
        activated = (now - timedelta(days=days)).isoformat() if active else None
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "address": addr_of[uid],
            "uid": uid,
            "sponsor": addr_of[sp] if sp else None,
            "binary_parent": addr_of[bp] if bp else None,
            "binary_side": side,
            "total_deposited": stake,
            "is_active": active,
            "owner_tier": False,
            "activated_at": activated,
            "created_at": now.isoformat(),
            "last_seen": now.isoformat(),
        })
    return {"seeded": len(nodes), "root_address": addr_of["DEMO_ROOT"], "addresses": addr_of}


# ------------------------------------------------------------------ Admin panel (read + management data)
@api_router.get("/admin/overview")
async def admin_overview(x_admin_key: Optional[str] = Header(default=None)):
    _require_admin(x_admin_key)
    total = await db.users.count_documents({})
    active = await db.users.count_documents({"is_active": True})
    owner = await db.users.count_documents({"owner_tier": True})
    agg = await db.users.aggregate([{"$group": {"_id": None, "sum": {"$sum": "$total_deposited"}}}]).to_list(1)
    total_staked = float(agg[0]["sum"]) if agg else 0.0
    snap = await db.reward_snapshots.find_one({"_id": "latest"}) or {}
    return {
        "user_count": total,
        "active_count": active,
        "owner_club_count": owner,
        "total_staked_usd": round(total_staked, 2),
        "latest_root": snap.get("root"),
        "latest_root_at": snap.get("created_at"),
        "latest_leaf_count": snap.get("leaf_count", 0),
        "pools": snap.get("pools", {}),
    }


@api_router.get("/admin/users")
async def admin_users(q: str = "", page: int = 1, limit: int = 25,
                      x_admin_key: Optional[str] = Header(default=None)):
    _require_admin(x_admin_key)
    query = {}
    if q:
        q = q.strip()
        query = {"$or": [
            {"address": {"$regex": _re.escape(q.lower()), "$options": "i"}},
            {"uid": {"$regex": _re.escape(q), "$options": "i"}},
        ]}
    page = max(1, page); limit = max(1, min(100, limit))
    total = await db.users.count_documents(query)
    snap = await db.reward_snapshots.find_one({"_id": "latest"}) or {}
    bmap = snap.get("breakdown") or {}
    rows = []
    async for u in db.users.find(query).skip((page - 1) * limit).limit(limit):
        addr = u["address"].lower()
        bd = bmap.get(addr, {})
        rows.append({
            "address": addr,
            "uid": u.get("uid"),
            "sponsor": u.get("sponsor"),
            "stake_usd": float(u.get("total_deposited", 0) or 0),
            "is_active": bool(u.get("is_active", False)),
            "owner_tier": bool(u.get("owner_tier", False)),
            "rank": bd.get("rank", "-"),
            "mining_cap_usd": bd.get("mining_cap_usd", 0),
            "monthly_qualified": bd.get("monthly_qualified", False),
            "binary": bd.get("binary", {}),
            "total_claimable_usd": bd.get("total_claimable_usd", 0),
        })
    return {"total": total, "page": page, "limit": limit, "rows": rows}


@api_router.get("/admin/user/{address}")
async def admin_user_detail(address: str, x_admin_key: Optional[str] = Header(default=None)):
    _require_admin(x_admin_key)
    addr = address.lower()
    u = await db.users.find_one({"address": addr})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    snap = await db.reward_snapshots.find_one({"_id": "latest"}) or {}
    bd = (snap.get("breakdown") or {}).get(addr, {})
    pdoc = await db.reward_proofs.find_one({"_id": addr})
    return {
        "address": addr,
        "uid": u.get("uid"),
        "sponsor": u.get("sponsor"),
        "binary_parent": u.get("binary_parent"),
        "binary_side": u.get("binary_side"),
        "stake_usd": float(u.get("total_deposited", 0) or 0),
        "is_active": bool(u.get("is_active", False)),
        "owner_tier": bool(u.get("owner_tier", False)),
        "activated_at": u.get("activated_at"),
        "breakdown": bd,
        "proofs": pdoc.get("proofs", []) if pdoc else [],
    }



app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def seed():
    if not await db.protocol_stats.find_one({"_id": "protocol"}):
        await db.protocol_stats.insert_one(DEFAULT_STATS.copy())
    logger.info("TITAN API ready. Chain ID=%s", CHAIN_ID)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
