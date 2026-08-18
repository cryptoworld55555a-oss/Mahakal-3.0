# TITAN (TTN) — Product Requirements (living doc)

## Problem statement (original)
Mobile-first DeFi dApp on BNB Smart Chain. Users activate an ID with USDT (min $10, no upper cap); on claim they receive TTN (bought from PancakeSwap). Module 1 = foundation only: token, contract skeletons, and the main mobile dashboard.

## Token spec (locked)
- Name Titan · Symbol TTN · Decimals 18 · BEP-20 on BNB Smart Chain
- Total supply 200,000 TTN (fixed, no infinite mint)

## Architecture (hybrid, hardened)
- On-chain: money (activation USDT, pool balances, claim payout, PancakeSwap buy).
- Off-chain (FastAPI + MongoDB): MLM/team/pool calculation + backend-signed claim authorization; contract verifies signature and pays automatically.

## User choices (Module 1)
- Priority: mobile-first dashboard UI + backend APIs
- Data: backend real data, contract addresses config-driven
- Wallet: WalletConnect (also MetaMask/injected + Demo wallet for testing)
- Auth: wallet-based only (SIWE; address is identity, UID generated on connect)
- Contracts: compile-ready skeletons now; deploy to testnet later

## Tech stack
- Contracts: Solidity 0.8.24 + OpenZeppelin (ReentrancyGuard, SafeERC20, Pausable, ECDSA), Hardhat
- Frontend: React 19 + ethers v6 + Tailwind + framer-motion; WalletConnect v2 (ethereum-provider)
- Backend: FastAPI + eth_account (SIWE verify)
- DB: MongoDB (users, nonces, counters, protocol_stats)

## Implemented — 2026-08-18 (Module 1 + activation/countdown)
- Backend: /api/health, /api/config, /api/dashboard/stats (now with min_activation_usdt + daily/weekly/monthly reset timestamps), /api/auth/nonce, /api/auth/verify (SIWE, one-time nonce, chain-id check), /api/user/{address}, /api/activate (demo/off-chain: min $10, idempotent for active IDs, amount gt=0, updates ledger split).
- Frontend: mobile-first dashboard (creator balance, pools w/ live countdown timers, community fund, total supply 200,000 TTN, total activated users), header wallet connect + UID + Active/Inactive badge, Connect Wallet sheet (WalletConnect / MetaMask / Demo — portaled), Activate Your ID card (quick $10/$50/$100 + custom, min $10) that flips status to Active, bottom nav with Coming Soon for other modules, session persistence.
- Contracts (/app/contracts): TitanToken (ERC20Capped 200k), MainProtocol, RewardEngine (backend-signed claim + PancakeSwap buy w/ slippage+cap+nonce), PoolManager, CommunityFund, MockUSDT (testnet faucet). **Compile verified locally** via Hardhat (solc 0.8.24, evmVersion paris, OZ 5.0.2) — 23 files compiled. Not yet deployed.
- Tested: backend 28/28; frontend 100% across iterations 1–3. Fixed critical modal stacking bug + activation idempotency.

## Backlog / next modules
- P1: Deploy contracts to BSC Testnet (needs funded deployer key + tBNB), deploy MockUSDT faucet, wire real on-chain reads/activation, set REACT_APP_WC_PROJECT_ID for live WalletConnect.
- Later: per-address deposit ledger collection (auditability), nonce rate-limiting, strict SIWE line parsing, paid audit before mainnet.
- Module 3: Daily/Weekly/Monthly pool distribution + eligibility
- Module 4: Referral, Level income, My Team, Rank
- Module 5: Mining + Claim (PancakeSwap buy-and-send) + Profile

## Implemented — 2026-08-19 (Full reference dashboard, demo data)
- Expanded Dashboard to match user's reference video (electric-blue, TITAN logo, TTN): WelcomeStatus (UID, Active/Inactive, 1 TTN = $10 + sparkline, logo), Referral link + Copy, **Global Business** (Daily/Weekly/Monthly pools: amount, Qualified IDs, Sharing, countdown, eligibility pill), **My Business** (Stake, Mining cap + Generated reward + Mine, TTN Holding + Sell + mined/current/appreciation, Total Profit donut w/ 5 sources), **Team Reward** (Direct/Level), Mining Contract on-chain link, Recent Activity table, Top TTN Holders (search + pagination), bottom nav with raised center TITAN logo. Every card has a `.card-glow` blue underglow.
- Backend: /api/dashboard/stats now returns price_usd + price_spark + pool_meta (qualified_ids/sharing); new /api/me/{address} (per-user business/profit/team/activity demo data) and /api/holders (200 deterministic mock holders, search + paginated, page_size clamped 1..100).
- Recharts used for sparkline + profit donut.
- Tested: backend 42/42 pytest; frontend 100% functional (iteration_5); cosmetic 360px header/pool overflow fixed (horizontal overflow = 0). Demo ledger reset to clean defaults.

## Notes
- **Theme (2026-08-19, v2):** Converted entire UI from electric-blue to **Emerald Green + Lime + Gold + Orange** on a dark black-green base (#04110A), per user's reference mockup. Green/gold card borders + green→gold→orange underglow, green→gold/orange gradient buttons, green→gold graph line, green/gold icons & headings, white numbers, soft-gray secondary text; donut uses green/lime/gold/orange. Logo kept as-is with green glow ring. Layout/sizes/functionality unchanged. Migration done via /tmp/theme_migrate.py (hex/rgb map) + targeted gold/orange edits.
- Activation is DEMO/OFF-CHAIN: backend simulates USDT deposit and mutates a seeded MongoDB ledger (no real chain / no real USDT). Dashboard balances are seeded mock values (config-driven).
- WalletConnect live path disabled until REACT_APP_WC_PROJECT_ID is provided; Demo Wallet + MetaMask work now.
- Tokenomics split on activation is a placeholder (creator 20%, each pool 15%, community 15%); confirm final split before on-chain.
- Contracts compiled locally (Hardhat, solc 0.8.24 evmVersion paris, OZ 5.0.2). Deploy to BSC Testnet is pending a funded deployer key (user will test first, then mainnet).
