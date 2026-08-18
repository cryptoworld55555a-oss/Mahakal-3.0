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
        "created_at": doc.get("created_at"),
    }


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


@api_router.get("/dashboard/stats")
async def dashboard_stats():
    stats = await db.protocol_stats.find_one({"_id": "protocol"})
    if not stats:
        await db.protocol_stats.insert_one(DEFAULT_STATS.copy())
        stats = DEFAULT_STATS
    total_users = await db.users.count_documents({})
    total_activated = await db.users.count_documents({"is_active": True})
    return {
        "creator_balance_usdt": stats["creator_balance_usdt"],
        "pools": {
            "daily_usdt": stats["daily_pool_usdt"],
            "weekly_usdt": stats["weekly_pool_usdt"],
            "monthly_usdt": stats["monthly_pool_usdt"],
        },
        "community_fund_usdt": stats["community_fund_usdt"],
        "total_supply_ttn": stats["total_supply_ttn"],
        "total_users": total_users,
        "total_activated_users": total_activated,
        "token": TOKEN_SPEC,
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
