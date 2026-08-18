from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import uuid
import random
from datetime import datetime, timezone, timedelta

from eth_account import Account
from eth_account.messages import encode_defunct

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
    "creator_balance_usdt": 12500.0,
    "daily_pool_usdt": 3200.0,
    "weekly_pool_usdt": 8750.0,
    "monthly_pool_usdt": 21400.0,
    "community_fund_usdt": 45000.0,
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


def _public_user(doc: dict) -> dict:
    return {
        "address": doc["address"],
        "uid": doc["uid"],
        "is_active": doc.get("is_active", False),
        "activated_at": doc.get("activated_at"),
        "total_deposited": doc.get("total_deposited", 0),
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
    user = User(address=addr, uid=uid, last_seen=now)
    await db.users.insert_one(user.model_dump())
    return _public_user(user.model_dump())


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
    await db.protocol_stats.update_one(
        {"_id": "protocol"},
        {
            "$inc": {
                "creator_balance_usdt": round(amt * 0.20, 2),
                "daily_pool_usdt": round(amt * 0.15, 2),
                "weekly_pool_usdt": round(amt * 0.15, 2),
                "monthly_pool_usdt": round(amt * 0.15, 2),
                "community_fund_usdt": round(amt * 0.15, 2),
            },
            "$set": {"updated_at": now},
        },
        upsert=True,
    )

    updated = await db.users.find_one({"address": addr})
    return _public_user(updated)


@api_router.get("/dashboard/stats")
async def dashboard_stats():
    stats = await db.protocol_stats.find_one({"_id": "protocol"})
    if not stats:
        await db.protocol_stats.insert_one(DEFAULT_STATS.copy())
        stats = DEFAULT_STATS
    total_users = await db.users.count_documents({})
    total_activated = await db.users.count_documents({"is_active": True})

    daily = round(stats["daily_pool_usdt"], 2)
    weekly = round(stats["weekly_pool_usdt"], 2)
    monthly = round(stats["monthly_pool_usdt"], 2)
    q_daily = max(1, int(total_activated))
    q_weekly = max(1, int(total_activated * 0.5) or 1)
    q_monthly = max(1, int(total_activated * 0.3) or 1)

    return {
        "creator_balance_usdt": round(stats["creator_balance_usdt"], 2),
        "pools": {"daily_usdt": daily, "weekly_usdt": weekly, "monthly_usdt": monthly},
        "pool_meta": {
            "daily": {"qualified_ids": q_daily, "sharing_usdt": round(daily / q_daily, 2)},
            "weekly": {"qualified_ids": q_weekly, "sharing_usdt": round(weekly / q_weekly, 2)},
            "monthly": {"qualified_ids": q_monthly, "sharing_usdt": round(monthly / q_monthly, 2)},
        },
        "community_fund_usdt": round(stats["community_fund_usdt"], 2),
        "total_supply_ttn": stats["total_supply_ttn"],
        "total_users": total_users,
        "total_activated_users": total_activated,
        "min_activation_usdt": MIN_ACTIVATION_USDT,
        "price_usd": TOKEN_PRICE_USD,
        "price_spark": PRICE_SPARK,
        "resets": _pool_resets(),
        "token": TOKEN_SPEC,
    }


def _mock_hash(seed: str) -> str:
    r = random.Random(seed)
    hexs = "0123456789abcdef"
    return "0x" + "".join(r.choice(hexs) for _ in range(4)) + "…" + "".join(r.choice(hexs) for _ in range(4))


@api_router.get("/me/{address}")
async def me(address: str):
    addr = address.lower()
    doc = await db.users.find_one({"address": addr})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")

    active = doc.get("is_active", False)
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
        "stake_usdt": 0.0,
        "mining": {"available_cap_usdt": 0.0, "generated_reward_usdt": 0.0, "requires_usdt": 1.0},
        "holding": {"ttn": 0.0, "mined_value_usdt": 0.0, "current_value_usdt": 0.0, "appreciation_usdt": 0.0},
        "total_profit_usdt": 0.0,
        "profit_sources": [
            {"label": "Generation", "value": 0.0, "color": "#2F6BFF"},
            {"label": "Appreciation", "value": 0.0, "color": "#4F8DFF"},
            {"label": "Direct", "value": 0.0, "color": "#6AA0FF"},
            {"label": "Level", "value": 0.0, "color": "#1E40AF"},
            {"label": "Owner Club", "value": 0.0, "color": "#3B82F6"},
        ],
        "team": {"direct_reward_usdt": 0.0, "level_reward_usdt": 0.0},
        "recent_activity": activity,
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
    data = _HOLDERS_CACHE
    if search:
        s = search.lower()
        data = [h for h in data if s in h["address"].lower()]
    total = len(data)
    pages = max(1, (total + page_size - 1) // page_size)
    page = max(1, min(page, pages))
    start = (page - 1) * page_size
    sliced = data[start:start + page_size]
    ranked = [{"rank": start + i + 1, **h} for i, h in enumerate(sliced)]
    return {"total": total, "page": page, "pages": pages, "page_size": page_size, "holders": ranked}


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
