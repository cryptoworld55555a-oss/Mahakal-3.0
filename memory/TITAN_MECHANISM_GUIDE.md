# TITAN (TTN) — Full Mechanism (as built)

## 0. Fund split (jab 100% stake aata hai)
- 60% → TTN PancakeSwap se BUY hoke auto-stake (mining ke liye)
- 5% → Developer/Platform fund
- 35% → Reward reserve (USDT) — Direct/Level/Daily/Weekly distribute ke liye
- Min stake $10, Max $1000/din

## 1. Registration + Referral link
- Sponsor apna link share karta hai: app-url/?ref=<sponsor_wallet_address>
- Naya user us link se aake wallet connect + Register + Stake karta hai
- Sponsor-downline tree ban jaata hai (left/right sponsor khud choose karta hai binary ke liye)

## 2. ROI (self mining)
- Mining cap = stake × 200% (standard) ya × 300% (owner)
- Daily ROI = available mining cap ka 0.5% roz
- ROI se koi 10% deduction NAHI (poora user ka)

## 3. Teen Pool
DAILY pool: qualify = 1 active direct ($50+ stake) + available cap ≥ $100. Cap NAHI ghatata.
WEEKLY pool: qualify = 5 active directs ($50+) + available cap ≥ $200. Cap NAHI ghatata.
MONTHLY (Owner Club): qualify = Diamond rank + 10 directs + $2000 direct business + 25 qualified IDs (left) + 25 qualified IDs (right) + $5000 carry (left) + $5000 carry (right). Qualify hone pe cap 300% (permanent).
- Pool amount sab qualified members me EQUALLY split.

## 4. Rank + Level income (kul 25%, 15 level)
- L1 (direct) = 7%
- L2-L3 = 3% each
- L4-L6 = 2% each
- L7-L9 = 1% each
- L10-L15 = 0.5% each
Rank (level unlock):
- Active → L1 (bas active membership)
- Star → L2-3 : 5 active directs
- Silver → L4-6 : 5 directs + $1000 direct business
- Gold → L7-9 : 10 directs + $2000 direct business
- Diamond → L10-15 : 10 directs + $2000 direct + $5000 (15-level) team business
- Level income downline ke STAKE amount pe milta hai (ROI pe nahi), har stake pe (cumulative).
- STAKE-TIME strict: reward tabhi jab upline us stake ke WAQT qualify tha. Baad me qualify → purane stakes ka retro NAHI.
- Agar upline qualify nahi → wo level LAPSE, kisi ko nahi milta (na roll-up), reserve me rehta = admin profit.

## 5. Capping (kaise ghatti hai)
- CLAIM (ROI/Level/Daily/Weekly/Monthly) se cap KABHI nahi ghatata — claim me TTN wallet me aata hai (live price pe buy).
- Cap SIRF tab ghatati hai jab user TTN → USDT SELL kare, aur exactly utni USDT ke barabar jitni SELL pe mili (live price).
- Isliye claim karo, rate badhne do, phir sell karo → jitni USDT mili utna hi cap kam.

## 6. Monthly pool funding (10% deduction)
- Har user ke Direct + Level + Daily + Weekly reward se 10% kaata hai → Monthly Owner pool.
- Self-ROI se 10% NAHI kaata.
- User ko har reward ka net 90% milta hai; 10% monthly pool me → qualified owners me equally.

## 7. Pool RECYCLE (har period condition dobara)
- DAILY: har din reset — agla din pool lene ke liye condition (1 direct $50+ + cap $100) us din phir se poori karni hogi.
- WEEKLY: har hafta reset — 5 directs $50+ + cap $200 har hafte phir fulfil.
- MONTHLY: har mahina — owner qualification (Diamond + legs + carry) recycle; business claim ke baad reset, na-claim to carry-forward.
- Matlab koi bhi pool ek baar qualify karke hamesha nahi milta — har period condition dobara poori karni padegi.

## 8. Trust / Security (mainnet)
- 99% supply DIRECT Protocol contract pe (deploy time) — wallet->contract transfer nahi.
- Protocol → Safe multisig (renounce NAHI — setMerkleRoot chahiye reward ke liye).
- Token → renounce. Security (block/unblock) → aapke paas.
- Liquidity → LP token burn (dead address) → permanently locked.
