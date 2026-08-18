# TITAN (TTN) — Contracts (Module 1 skeleton)

BEP-20 token + 4 protocol contract skeletons for BNB Smart Chain.

## Contracts
- `TitanToken.sol` — BEP-20, fixed **200,000 TTN**, no infinite mint (ERC20Capped).
- `MainProtocol.sol` — activation (USDT deposit, min $10, no upper cap), user registry, orchestration.
- `RewardEngine.sol` — backend-signed + contract-verified claim; PancakeSwap buy-and-send with slippage + max cap.
- `PoolManager.sol` — daily / weekly / monthly pool accounting.
- `CommunityFund.sol` — reserved ecosystem allocation & tracking (no drain backdoor).

## Security guardrails
- `ReentrancyGuard` on every fund-moving function.
- Claims are **backend-signed and contract-verified** (nonce anti-replay).
- PancakeSwap buy uses **slippage protection (`minTtnOut`) + max cap**.
- Admin actions are `Pausable` + event-logged; no owner "drain funds" path.

## Setup & deploy (later, once you provide a funded testnet key)
```bash
cd contracts
npm install
cp .env.example .env   # fill DEPLOYER_PRIVATE_KEY, USDT_ADDRESS, BACKEND_SIGNER
npm run compile
npm run deploy:testnet
```
Then copy the printed addresses into `backend/.env` and `frontend/.env` (config-driven).

> Module 1 is foundation only. Splits, referrals, pool distribution & claim orchestration land in Modules 2–5. Mainnet only after a paid audit.
