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

## Implemented — 2026-08-18 (Module 1)
- Backend: /api/health, /api/config, /api/dashboard/stats, /api/auth/nonce, /api/auth/verify (SIWE, one-time nonce, chain-id check), /api/user/{address}; UID counter (TTN100001+); seeded protocol_stats ledger.
- Frontend: mobile-first dashboard (creator balance, daily/weekly/monthly pools, community fund, total supply 200,000 TTN, total activated users), header wallet connect + UID + Active/Inactive badge, Connect Wallet sheet (WalletConnect / MetaMask / Demo), bottom nav with Coming Soon for other modules, session persistence.
- Contracts (/app/contracts): TitanToken (ERC20Capped 200k), MainProtocol (activation), RewardEngine (backend-signed claim + PancakeSwap buy w/ slippage+cap+nonce), PoolManager, CommunityFund; Hardhat config + deploy script + README.
- Tested: backend 17/17; frontend wallet flow + dashboard 100% (iteration_1, iteration_2). Fixed critical modal stacking bug (portal to body).

## Backlog / next modules
- P1: Deploy contracts to BSC Testnet (needs funded key), wire real on-chain reads, set REACT_APP_WC_PROJECT_ID for live WalletConnect.
- Module 2: Activation + Stake flow (USDT deposit -> is_active + UID on-chain)
- Module 3: Daily/Weekly/Monthly pool distribution + eligibility
- Module 4: Referral, Level income, My Team, Rank
- Module 5: Mining + Claim (PancakeSwap buy-and-send) + Profile
- Later: nonce rate-limiting, strict SIWE line parsing, paid audit before mainnet.

## Notes
- Dashboard pool/creator/community balances are MOCKED seed values in MongoDB (config-driven ledger) until contracts are deployed.
- WalletConnect live path disabled until REACT_APP_WC_PROJECT_ID is provided.
