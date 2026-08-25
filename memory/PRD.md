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

## Implemented — 2026-06 (Monthly pool conditions finalized)
- PoolsPage.jsx: Monthly Owner Club Reward now shows the user-confirmed 8 conditions (1 met + 7 pending): Active membership (min $50) ✓, Active directs 0/10 (min $50 each), Direct business $0/$2,000, Left qualified IDs 0/25, Right qualified IDs 0/25, Left matching carry $0/$5,000, Right matching carry $0/$5,000, On-chain qualification (pending). Monthly card + info modal now show red **"REDUCES mining cap"** (daily/weekly still green "Does NOT reduce"). Qualified logic uses reqs.every when reqs present. Verified via screenshot. USER-CONFIRMED values.

## Implemented — 2026-06 (My Team / Network & Referral page)
- New backend endpoint GET /api/team/{address} (server.py): returns sponsor (demo), binary left/right structure (business+team size), direct referrals (reward/count/active/inactive), 15-level team summary, team accounting (direct-level rewards + lapsed), level qualification progress (Level 1 unlocked on active; Star L2-3 needs 5 directs; Silver L4-6 needs 5 directs + $1,000 biz; Gold L7-9 needs 10 directs + $2,000 biz; Diamond L10-15 needs 10 directs + $2,000 biz + $5,000 15-level team biz), members list + total_members. All zero for new/inactive user (demo, matches reference video).
- New frontend MyTeamPage.jsx wired into App.js "team" tab (BottomNav My Team). Sections: My Sponsor (+copy), Your Referral Link (+copy), My Team Structure (Left/Right), Direct Referrals (+View directs), 15-Level Team Summary, Team Accounting, Level Qualification Progress (tier icons User/Star/Award/Trophy/Gem, X/15 badge, req chips), Total Team (All/Left/Right filter tabs + All Levels dropdown + table NAME/SIDE/LVL/STAKE/STATUS + empty state + pagination). Green/gold/orange theme kept. Connect-wallet empty state when no address. api.js getTeam added. Removed unused ComingSoon.
- Tested: backend via curl (200 with correct shape); frontend via screenshots (Demo wallet -> My Team, all sections render correctly). DEMO/OFF-CHAIN data.

## Implemented — 2026-06 (Pre-connect Landing page)
- New Landing.jsx (green/gold/orange theme, TITAN branding) shown when wallet NOT connected; on connect → app opens directly (Dashboard). App.js now gates: isConnected ? (Header+tabs+BottomNav) : <Landing/>. WalletProvider already wraps App (index.js).
- Landing sections (adapted from user's AETHERA reference video): sticky nav + Connect, Hero (Community Powered / Mining Ecosystem / MINE·HOLD·GROW + 3D TITAN coin (AI-generated, config COIN_HERO_URL) + live TTN price card w/ recharts sparkline from /dashboard/stats), PancakeSwap Liquidity Pool (LIVE; USDT 2000 / TTN 200 / Value $4000 from new stats.liquidity), Why TITAN (4), Our Vision, Tokenomics (200,000 TTN / BSC / $2,000 initial liq / $10 launch price / renounced etc), Special Features (4), Protocol Contracts (5 rows, all "Deploying on testnet" since 0x000 — no private key row per safety), Stake Participation (200% Standard / 300% Owner Club), Ecosystem Working Module (5 steps: Registration/Stake $10-1000/Allocation 60-35-5/Mining min $10/Reward Distribution), Reward Distribution (4 cards + rules incl. $50 min, reduces mining cap, daily/weekly do NOT reduce), Trusted·Transparent·Secure (4), CTA, Footer (Useful Links + socials placeholder #).
- Download PPT -> "coming soon" toast; social/footer links -> "coming soon" toast (placeholders, per user).
- Backend: /dashboard/stats now returns "liquidity" {usdt, ttn, value_usd, pair}.
- Tested: backend curl (liquidity + price ok); frontend screenshots (all sections render, wallet modal opens, Demo connect -> Dashboard, Landing hidden, BottomNav visible). DEMO data.

## Smart Contracts — 2026-06 (Security/Admin + Protocol written & tested)
Mechanism source of truth: AETHERA whitepaper (user confirmed TITAN = same, only name TTN). Business rules CONFIG-BASED (admin-settable), NOT hardcoded.
- Split: 60% reserve (buy TTN on Pancake, stored in contract) / 5% dev / 35% reward reserve.
- 25% Level income (of 35 bucket): L1(direct)=7%, L2-3=3% each, L4-6=2% each, L7-9=1% each, L10-15=0.5% each = 25%. Daily 5% + Weekly 5%. Monthly pool = deduction from Daily+Weekly payouts only (per user override).
- Mining cap 200% standard / 300% Owner Club; 0.5%/day generation (off-chain). CAP REDUCES ON SELL (USD extracted at market rate), capped at available; restake for more. Reward lapses if no cap (direct/level/monthly reduce cap; daily/weekly do NOT).
- Registration FREE; renewal $10 / 200 days. Owner qualify: Diamond + $5000 both legs (25+25 IDs).
- Architecture = HYBRID: funds/activation/stake/mining-cap/PancakeSwap buy&sell on-chain; MLM/level/matching/pool math off-chain, authorized via backend EIP-191 signed messages + nonce replay protection.

Contracts (/app/contracts/contracts):
- TitanToken.sol (existing) — BEP-20, 200k capped.
- TitanSecurityAdmin.sol (NEW) — security/control center, NO funds. AccessControl roles (DEFAULT_ADMIN/ADMIN/PAUSER), block/unblock (blocked user cannot activate/stake/claim/reward/sell), batch block, global pause/resume, approvedContract registry, protected system wallets (DEV/DAILY/WEEKLY/MONTHLY/LIQUIDITY, updatable only by DEFAULT_ADMIN=multisig), whenActive() + requireApproved() guards, events for every action.
- TitanProtocol.sol (NEW) — core funds+logic. register/renew, stake (split+buy TTN+grant cap+daily-max+multiples), claimReward (signed, capReduce flag), sellMined (signed, swap TTN->USDT, cap reduce = USD out, capped), admin config setters (split/caps/limits/renewal/router/signer/wallets/ownerTier), Ownable, ReentrancyGuard, SafeERC20, security.whenActive checks.
- MockUSDT.sol / MockRouter.sol (test-only), CommunityFund.sol (existing).

Testing: `npx hardhat test` → 7/7 passing (stake split+cap, block halts, pause halts, signed claim + nonce replay, no-cap-no-reward, sell reduces cap, stake validation). Compiles clean (solc 0.8.24, evmVersion paris, OZ 5.0.2).

TODO next: level-income cascade + pool eligibility backend (off-chain signer service), EIP-712 typed signatures (currently EIP-191 packed), appreciation-on-sell exact math, deploy scripts wiring (SecurityAdmin.setApprovedContract(protocol), setSystemWallets), then BSC Testnet deploy (needs funded deployer key) + frontend on-chain switch.

## BSC TESTNET DEPLOYED — 2026-06 (chainId 97)
Deployer (throwaway, testnet-only): 0xCb64A7c9895A3807F23a23c25e0dB138b3A3e0cd
- TitanToken (TTN): 0xa38427DA27828A72699Df34c694038921Aa19f9B
- TitanProtocol: 0xbC55Cd51761c4369754DAc706881C983C7FA35eC
- TitanSecurityAdmin: 0x572Fc8027F6Ad901DF785C33F4Ae9012c6b06E6c
- CommunityFund: 0x8cF4bd0bBf10310bF4D8d81aD12dc6cc1f4e8F9B
- MockUSDT: 0x0aAA413E7C9f7545Db77FfD3a96F7a640AB55D0F
- PancakeSwap V2 router (testnet): 0xD99D1c33F9fC3444f8101754aBC46c52416550D1
Deploy cmd: `npx hardhat run scripts/deploy.js --network bscTestnet`. Deployer creds in contracts/.env (DEPLOYER_MNEMONIC) — TESTNET THROWAWAY (seed was shared in chat; never use for mainnet/real funds).
On-chain testnet tests PASSED (scripts/onchain-test.js): register OK, MockUSDT faucet+approve OK, blockUser -> stake reverted, pause(block-all) -> whenActive reverted, unblock/unpause verified (isBlocked=false, paused=false).
NOT yet done on testnet: full stake (60% buy TTN) + claim + sell — need TTN/USDT liquidity added on PancakeSwap testnet + backend signer service. Frontend still demo (on-chain switch pending).

## FULL FLOW TESTED ON BSC TESTNET — 2026-06 ✅
- PancakeSwap testnet liquidity added: 1000 TTN + 10000 USDT (1 TTN=$10). LP pair: 0xd861eb6d75271771980099ad79bD6B8A1b514717. (scripts/add-liquidity.js)
- scripts/full-flow.js verified on-chain: stake $100 -> 60% bought ~6 TTN via Pancake (protocol reserve), 5% dev, 35% USDT reserve, miningCap 200. claimReward $10 (signed, capReduce) -> USDT reserve 35->25, cap 200->190. sellMined 2 TTN (signed) -> TTN reserve 6->3.95, cap 190->169.84 (reduced by USD received). Final state (scripts/state.js): totalStaked 100, miningCap 169.84, TTN reserve 3.95, USDT reserve 25 — all reconcile.
- Signer = deployer (testnet). EIP-191 packed sigs. Scripts: deploy/check/onchain-test/add-liquidity/full-flow/state/verify.js.
- REMAINING: backend signer service (level/matching/pool calc + real signatures), admin panel UI (search-block + pause + per-user cap/value), frontend on-chain switch (demo->real). Then audit -> mainnet (real USDT 0x55d398..., real router 0x10ED43...).

## CLAIM UPDATED to deliver TTN + REDEPLOYED — 2026-06
claimReward now BUYS TTN live from PancakeSwap with the USD reward value and sends TTN to user wallet (was USDT). New param minTtnOut (slippage). Signature unchanged (usdtValue, capReduce, nonce, deadline). Applies to ALL rewards (level/daily/weekly/monthly) per user confirmation. Local Hardhat: 7/7 pass.
NEW BSC Testnet deployment (chainId 97, replaces earlier):
- TitanToken (TTN): 0x804b9997972b870c19778e6796DAc35440899355
- TitanProtocol: 0x32fb34Ea6720866c67DFB7a34Fb03d559B14A46c
- TitanSecurityAdmin: 0x35B40DBB9822E771a0C99b00a085F822f67D1Af0
- CommunityFund: 0x375b6321D040d06a05e699F3Fd1b42Eef9947cCb
- MockUSDT: 0x6Ef85C5ebd147E262c5E64b28F24A55333B85690
- Router (testnet): 0xD99D1c33F9fC3444f8101754aBC46c52416550D1
Liquidity re-added (1000 TTN + 10000 USDT). Verified on-chain: stake $100 -> cap 200; claim $10 -> cap 190, protocol USDT 35->25 (spent buying TTN), TTN bought sent to user, claim tx SUCCESS. Mechanism CONFIRMED: cap fixed 200% (300% owner), 0.5%/day x 200 days generation (off-chain), claim delivers TTN bought at live price, sell (TTN->USDT) reduces cap by USD received (capped at available).
Scripts added: verify2, claim-only, state2, debug.

## TTN TRANSFER-RESTRICTED (no third party) + REDEPLOYED — 2026-06
User confirmed: fixed 200k supply (no new mint); user CANNOT transfer TTN to any normal wallet — only to the approved protocol contract (for sell). No third-party/pump-dump.
- TitanToken._update override: transfer allowed only if from OR to is whitelisted (protocol + treasury/owner). Blocks user->user and pool->outsider. setWhitelisted(owner-only). Deploy whitelists protocol.
- TitanProtocol.claimReward: buys TTN to protocol then transfers to user (whitelist-safe). sellMined: pulls user's TTN into protocol (safeTransferFrom, user must approve) then sells on Pancake.
- Local Hardhat: 8/8 pass (added "TTN transfers restricted: user cannot send to random wallet, only to protocol").
NEW BSC Testnet deploy (chainId 97, replaces prior):
- TitanToken (TTN): 0x93a457066c8C00CB34c56eb6802BfD4282728818
- TitanProtocol: 0xC3003529750189a98158A6B73fAc1b33Cdad068c
- TitanSecurityAdmin: 0xfcB6c96c52d1B037A9b22980aDaA179611043136
- CommunityFund: 0xcfe197828AfEc35EfC5a4C7Fe346a7004CAc039b
- MockUSDT: 0x7f54d89589bE32eE2Eb125C12624b2A8AD338789
Verified on-chain (verify3.js): liquidity add OK, stake $100 -> cap 200, claim $10 -> tx SUCCESS, cap 190 confirmed. Restriction does NOT break protocol flows.

## On-chain Withdrawal menu — 2026-06
Header.jsx triple-line menu me "On-chain Withdrawal" option + modal added (config.js ONCHAIN: protocol/token/usdt/chainId/rpc/explorer). Shows Network, Chain ID, RPC, Protocol contract, TTN token (copyable) + BSCScan writeContract link + guide. data-testids: menu-onchain-withdraw, onchain-withdraw-modal, onchain-bscscan-link. Verified via screenshot.
PENDING for real launch (NOT done): permissionless sell (contract change), Backend Reward Engine (level 25% cascade, matching, daily/weekly/monthly pools, rank Star/Silver/Gold/Diamond, monthly 300x), Merkle authorization, frontend on-chain switch (real stake/claim/sell), multi-ID full testing, professional audit before mainnet. App still DEMO/mock for reward flows.

## PERMISSIONLESS SELL added + REDEPLOYED — 2026-06
TitanProtocol.sell(ttnIn, minUsdtOut, deadline): permissionless (NO signature) site-independent withdrawal. Pulls user's own TTN, swaps TTN->USDT on Pancake, reduces mining cap by USD received (bounded by available cap + own wallet TTN), blocked users reverted (whenActive), ReentrancyGuard. Callable directly via BSCScan even if site/backend down. sellMined (signed) kept too.
Local Hardhat: 9/9 pass (added permissionless sell test + blocked-user-cannot-sell).
NEW BSC Testnet deploy (chainId 97, replaces prior; frontend config.js ONCHAIN updated):
- TitanToken (TTN): 0x619bB948d0f436287e50FAd36D536f3c2CA6C08e
- TitanProtocol: 0xf8eaf47A1Ee1a2f60f817743fCD72D33665ed537
- TitanSecurityAdmin: 0x05d85D76F3b5c562FBA34a619306a13ce4313B2C
- CommunityFund: 0x325e0B6dAD2a64c5175DcC4d7DA71417E35cBDa2
- MockUSDT: 0x88D326d04940433e27cBD9749e485223715bB397
On-chain verified (verify-sell.js): liquidity add, stake $100 -> cap 200, permissionless sell 5 TTN (NO sig) SUCCESS, cap 200 -> 149.75 (reduced by ~$50.25 USD received). Site-down withdrawal now real.

## [2026-06] Reward Engine Phase 1 (calculation brain) — DONE
- Added /app/backend/reward_engine.py: level cascade 25% (L1=7,L2-3=3,L4-6=2,L7-9=1,L10-15=0.5), self ROI 0.5%/day of cap, caps 200%/300%, rank gating ladder (Active L1 / Star L2-3 / Silver L4-6 / Gold L7-9 / Diamond L10-15), pool contributions (5% daily, 5% weekly, monthly = 10% deduction), monthly Owner Club 300x qualifier.
- Endpoints: POST /api/reward/simulate, POST /api/reward/monthly-qualify, GET /api/reward/config.
- testing_agent iteration_10: 16/19 pass; fixed 2 defects (Gold rank unreachable -> escalating thresholds; negative-input validation -> Pydantic ge=0). Both curl-verified.
### PENDING next chunks (NOT done):
- Merkle authorization contract + root publish + on-chain claim(proof) [large]
- Frontend on-chain switch: real ethers calls for activate/stake/claim/sell wired to latest testnet protocol 0xf8eaf47A1Ee1a2f60f817743fCD72D33665ed537
- Multi-ID testnet e2e: each rank, daily/weekly/monthly pools, all level records, Owner 300x, claim price-up effect, self ROI on-chain

## [2026-06] Merkle Reward Claim — DONE + testnet-verified
- CONTRACT (TitanProtocol.sol): added setMerkleRoot(root) [owner/multisig] + claimMerkle(cumulativeUsd, capReduce, minTtnOut, deadline, proof). Cumulative pattern (pays delta only, no replay). Verifies OZ StandardMerkleTree proof (leaf = keccak256(keccak256(abi.encode(user,uint256,bool)))). Buys TTN LIVE from PancakeSwap at claim-time price -> sends to user. capReduce bucket reduces mining cap; daily/weekly bucket does not. Blocked/paused users cannot claim. Enabled viaIR in hardhat.config.
- Backend = CALCULATOR ONLY (no fund-moving key): /app/backend/merkle.py (Python port of @openzeppelin/merkle-tree, verified BYTE-IDENTICAL to JS). Endpoints: POST /api/reward/merkle/build (root+proofs, dedupe (addr,capReduce), address regex validation), GET /api/reward/merkle/latest (persisted in db.merkle_roots).
- Hardhat tests: 12 passing (3 new Merkle: live-price claim, cumulative delta + forged proof revert, blocked user).
- REAL BSC TESTNET proof (scripts/merkle-testnet.js): deploy+liquidity(1 TTN=$10)+reserve+register+stake($100,cap 200)+setMerkleRoot+claimMerkle -> receipt status 1, cap 200->180, claimedReducingUsd=20, user received ~1.968 TTN for $20 at live price. Verified via scripts/verify-merkle.js.
- testing_agent iter_11: fixed HIGH (bad address -> 422) + duplicate-pair guard. All pass.
### NEW TESTNET ADDRESSES (frontend config.js ONCHAIN + .env updated):
- TOKEN=0x6cA29Dc3691F6a3B5bd0a7f7a2fCeD8F0BF15ffE
- PROTOCOL=0x98600401aadDb432cAf9698170725900829a4488
- SECURITY=0x130D992Dff0e12c7527A574E51501681767e6093
- COMMUNITY=0x67d0ebDd9CE07722045C32ACf3e624A5FfDBAA8F
- USDT=0xe7FC10358aa09eb969054E5a8e112Cf4770BDE0E
### PENDING next:
- Full off-chain reward tree walk (build cumulative leaves from real referral tree data)
- Frontend on-chain switch: real ethers claimMerkle/stake/sell wiring + fetch proof from /api/reward/merkle/build
- Multi-ID testnet e2e (all ranks/pools/levels/300x/price-up)

## [2026-06] Referral Tree Engine — DONE + tested (iter_12 all core pass)
- /app/backend/tree_engine.py compute(): walks REAL sponsor tree from db.users; per user computes
  self ROI (0.5%/day of cap, capped), level income (25% cascade up 15 uplines, gated by upline rank+active),
  daily pool (active users), weekly pool (rank>=Silver), monthly pool (owner-tier); rank from active directs+active direct business.
  Emits (address, cumulative_usd_wei, cap_reduce) leaves: reducing=level+monthly (capped at cap), non-reducing=roi+daily+weekly.
- Endpoints: POST /api/reward/tree/build (walk->merkle root+proofs, persists breakdown + per-user proofs in db.reward_proofs),
  GET /api/reward/tree/user/{address} (breakdown + claim proofs), POST /api/reward/tree/seed-demo (8-node demo net).
  Both writes optionally gated by ADMIN_API_KEY header (env). 
- Referral capture: /api/auth/verify accepts ref (uid or address) -> _resolve_sponsor stores sponsor; self-ref rejected. _public_user now returns sponsor.
- Verified: 29/29 tree proofs verify against root; DEMO_ROOT level_income=56, lapsed=19.5, roi=600, cap=3000(owner); DEMO_A roi=150.
- iter_12: all core pass; fixed minors (proofs->separate collection for 16MB scale; direct_business active-only; expose sponsor; dev-gate writes).
### PENDING next:
- Frontend on-chain switch: fetch proof from /api/reward/tree/user, call claimMerkle via ethers; stake/sell real calls
- Admin: post latest root on-chain (setMerkleRoot) button/flow; owner-tier qualification via monthly_owner_qualified (binary legs)
- Multi-ID real testnet e2e with staked wallets

## [2026-06] Task 1: Binary System (qualification only) — DONE + tested (iter_13: 105/105 pass)
- User rules CONFIRMED: Binary = ONLY monthly-pool + owner-club qualification (NO matching income). Placement = sponsor chooses left/right. Monthly pool = equal split among achievers (repeats each period). ONE-TIME qualification => 300% cap permanent. Binary counted 15 levels deep.
- tree_engine.compute(): added binary tree (binary_parent + binary_side), leg_stats() BFS 15-deep -> left/right active IDs + business. monthly_qualified = active + stake>=$50 + 10 active directs(>=$50 each) + $2000 direct business + 25 IDs each leg + $5000 business each leg. Monthly pool split equally among achievers only.
- /reward/tree/build now persists owner_tier=true for newly qualified users (one-time -> 300% cap on next build). reducing bucket = min(level_income + monthly_share, cap).
- seed-demo rewritten: 51-node binary network, DEMO_ROOT qualifies (10 directs/$2500, 25 IDs+$6250 each leg). Verified: build1 sets owner_tier, build2 cap=3000(300%).
- User model: added binary_parent, binary_side. _load_network reads them.
### Known minor/scale (non-blocking): admin-key gate is no-op unless ADMIN_API_KEY set; leg_stats O(N^2) on deep chains (memoize before scaling); monthly-pool share above a user's cap is clamped (excess not redistributed - revisit if real pool is large); merkle_roots collection grows per build (add TTL later).
### Binary PENDING: frontend placement capture (sponsor picks left/right at register); admin view of binary legs.

## [2026-06] Admin Panel + Block-All + cap-lag fix — DONE
- Admin Panel at /admin (AdminPanel.jsx): overview stats, user search/table (rank/cap/binary/monthly), Run Reward Engine, Post Root On-chain, per-user block/unblock/owner-tier, Pause/Resume, Seed Demo. Backend: /api/admin/overview, /api/admin/users (search+paginate), /api/admin/user/{address}. iter_14: backend 120/120, frontend load/engine/search/seed pass.
- NEW: "Block ALL Users" + "Unblock ALL Users" buttons (adminChain.blockAllOnChain = on-chain global pause; single cheap tx blocks activate/claim/sell for everyone via whenActive). Confirm dialog before firing.
- FIXED CRITICAL (iter_14): Owner-Club 300% cap lagged one engine run. build now applies newly-qualified owner_tier and RE-COMPUTES in the SAME run -> 300% cap immediate. Verified: fresh seed + single build => cap 3000.
### DECISION: token ownership renounce is deferred to the VERY END (mainnet, after all whitelisting). Protocol/Security stay owner-controlled.
### REMAINING BACKLOG (updated):
DONE: Binary(1), Owner-Club 300%(2), Admin UI/root-post/owner-tier(17,18,19), reward+tree engine, Merkle claim.
PENDING: Renewal 200d/$10 (3); Professional audit (4); Mainnet prep + renounce LAST + LP burn (5); WalletConnect real ID+QR (10); Frontend real Stake(11)/Claim-claimMerkle(12)/Sell(13); My Team real data(14); Dashboard/Mining/Pools real data(15); Referral link UI ?ref=uid (16); Multi-ID real testnet e2e (20).

## [2026-06] FULL E2E real testnet proof (scripts/full-e2e.js) — ALL PASS
Real BSC testnet, live PancakeSwap price. Deploy+liquidity(1 TTN=$10)+reserve, stake $100->cap $200.
- CLAIM level+monthly $15 (capReduce=true): got 1.477 TTN at live price; cap 200->185 (reduced $15); price $10.09->$10.12 UP.
- CLAIM ROI+daily+weekly $9 (capReduce=false): got 0.884 TTN; cap 185->185 UNCHANGED; price UP.
- SELL 3 TTN: got $30.35 USDT; cap 185->154.65 (reduced by USDT received); price $10.14->$10.08 DOWN.
Proves: every reward type pays TTN at LIVE price; monthly+level reduce cap; ROI+daily+weekly do NOT; claim=buy pushes price UP; sell pushes price DOWN + reduces cap. Reward $ math (level 25%/15lvl, ROI 0.5%/day, pools) already validated in iter10-13 (105+ unit tests). NOTE: public testnet RPC needs delays between rapid txs (stale reads/transient reverts) - script adds sleeps.

## [2026-06] RULE CORRECTION (user): cap reduces on EVERYTHING except daily & weekly pool
- tree_engine: cap-REDUCING bucket = self ROI + level income + monthly pool (was: only level+monthly). Non-reducing = daily pool + weekly pool ONLY. Self ROI MOVED to cap-reducing.
- On-chain: no contract change needed (claimMerkle capReduce flag already supports it); self-ROI leaf now emitted with capReduce=true. reducing sum still clamped to mining cap.
- Verified via demo: reducing = ROI+level+monthly (capped at cap), non-reducing = daily+weekly only.

## [2026-06] CAP MODEL FINALISED (user): cap reduces ONLY on SELL by actual USDT (claim never touches cap)
- User rule: all rewards (ROI/level/daily/weekly/monthly) claim -> PancakeSwap buy -> TTN to wallet, cap UNCHANGED. Cap (USDT) reduces ONLY when user SELLS TTN, by actual USDT received at live price. Example: claim $50, price 2x, sell for $100 -> cap -$100. Reason: cap-at-claim would spike price too fast (admin loss). Daily/weekly NOT specially exempt (option a - all sells reduce cap; simplest & safest).
- Contract: claimMerkle NO LONGER reduces miningCap (removed require/subtract); capReduce bool now just separates two cumulative streams. sell() reduces cap by actual usdtOut (unchanged). Local tests 12/12 pass.
- Backend tree_engine: removed cap clamp; emits stream_a (roi+level+monthly) + stream_b (daily+weekly) leaves; breakdown now has total_claimable_usd/claimable_stream_a/b (removed cumulative_reducing/nonreducing). server admin_users updated.
- REAL TESTNET e2e (full-e2e.js) verified: 2 claims cap 200->200 UNCHANGED + price UP; sell 3 TTN -> cap 200->169.65 (actual USDT) + price DOWN.
- NEW deployment (has liquidity+reserve): PROTOCOL 0x53F278bfCa7acED4c41734FF78840d52fdFD1a6f, TTN 0xd3123574F7C204c73c982972ea46b1086Bbe1079, USDT 0x2e64bc6A..., SECURITY 0x314DCAb3..., COMMUNITY 0x073DB912... (config.js + .env updated).
- CLEANUP-before-mainnet: legacy signature claimReward() still reduces cap (unused by frontend/engine) - remove during audit prep.

## [2026-06] Go-live WITHOUT paid audit (user decision) + FREE Slither hardening
- User has NO audit budget -> launching without professional audit, will audit later. Risk acknowledged (unaudited DeFi = real risk; no hack-proof guarantee).
- Ran Slither 0.11.6 (free static analyzer). Removed dead legacy functions claimReward() + sellMined() (signer-gated, unused) -> smaller attack surface. Fixed CommunityFund.totalAllocated init.
- Result: our contracts High 3->1, Medium 7->5. Remaining are NON-exploitable: reentrancy-balance/no-eth are all guarded by nonReentrant (false positives); unused-return is the intentional balBefore/balAfter swap pattern (safe).
- Local tests 10/10 pass after cleanup (added clean sell-reduces-cap test).
- Current testnet deploy (0x53F27...) still has legacy funcs (harmless, signer-gated); cleaned source deploys fresh at mainnet.
### FREE safety plan for launch: small initial liquidity (limit exposure), keep SecurityAdmin pause + block active, admin multisig, heavy testnet coverage, run Slither each change; proper audit when funds allow.

## [2026-06] Liquidity lock (LP burn) — script + testnet DEMO done
- scripts/lock-liquidity.js: burns ALL LP tokens (TTN/USDT pair) to dead 0x...dEaD -> removeLiquidity impossible for everyone (incl owner) -> DEX trackers show locked 🔒.
- Testnet DEMO verified: after burn, deployer LP = 0.0, dead address holds 100% of LP supply (3162.27). Liquidity permanently locked.
### MAINNET LAUNCH RUNBOOK (user-approved order):
1) Deploy cleaned contracts + set router/whitelist/approvedContract/community.
2) Add liquidity (TTN/USDT). 3) Run lock-liquidity.js -> BURN all LP to dead (permanent lock, shows 🔒 on DexScreener).
4) Renounce TITAN TOKEN ownership ONLY. 5) Keep Protocol+Security under owner/multisig for block/pause/root ops.
6) BscScan verify all 3 contracts (needs API key). Note: cap reduces only on SELL; claim buys TTN live.

## [2026-06] Task 3 Renewal — CONTRACT done + tested (11/11)
- Already in TitanProtocol: renewalFee=$10, renewalPeriod=200 days, renew() (charges $10 USDT to devWallet, resets renewedAt), isRenewalDue(user) view, Renewed event, admin setRenewal(fee,period).
- Added local test (time-travel 201d): isRenewalDue false->true->false, $10 fee to dev. 11/11 pass.
- PENDING (renewal frontend): "Renew" button + renewal-due countdown indicator -> build with Frontend On-chain Switch (11-13).

## [2026-06] Task 16 Referral DONE + chain.js foundation for 11-13
- Task 16: refLink already `${origin}/?ref=uid`. Wired: WalletContext captures ?ref on mount -> localStorage, and passes ref to verifySignature on connect -> backend _resolve_sponsor stores sponsor. End-to-end done.
- lib/chain.js added (foundation for 11-13): getAccount, registerOnChain, stakeOnChain (auto USDT approve), renewOnChain, claimAllRewards (fetches proofs from /reward/tree/user then claimMerkle each), sellOnChain (auto TTN approve). Uses injected MetaMask (no WalletConnect ID needed for desktop).
- App compiles + loads fine.
### NEXT: wire chain.js into Stake/Mining/Sell/Renew pages (11-13) + My Team/Dashboard real data (14-15). Needs real MetaMask for e2e. Task 10 WalletConnect QR needs Project ID. BscScan verify needs API key. Mainnet (5) = user runs runbook.

## [2026-06] Tasks 11-13 Frontend On-chain Switch + Renew — WIRED (via injected MetaMask)
- lib/chain.js used by UI. ActivateCard: getAccount->register if needed->stakeOnChain(USDT auto-approve)->activateId backend sync + step status. MiningPage: reads real on-chain cap/staked/renewalDue via getAccount; reward from GET /reward/tree/user (total_claimable_usd); mine-claim-btn -> claimAllRewards (fetch proofs + claimMerkle each); renew banner+btn when isRenewalDue; SellCard (data-testid sell-card/sell-amount-input/sell-submit-btn) -> sellOnChain. api.getRewardUser added.
- App compiles + loads, no JS errors. NOTE: full UI e2e needs real MetaMask (window.ethereum) which the preview lacks; underlying contract fns are testnet-proven (full-e2e.js). getAccount fails gracefully when no wallet (cap shows 0).
### REMAINING: 14-15 My Team + Dashboard real data (still mock getTeam/stats); 10 WalletConnect QR (needs Project ID); BscScan verify (API key); 5 mainnet (user runs runbook).

## [2026-06] Tasks 14-15 My Team + Dashboard REAL data — DONE
- /api/team/{address}: now computed from reward snapshot breakdown + live direct counts. Returns real rank, binary L/R ids+business, directs count/active, level reward, level lapsed, rank qualification (real have/need per tier), members list. (was all-zeros mock)
- /api/me/{address}: enriched from breakdown -> real stake, mining cap, generated reward (total_claimable), rank, monthly_qualified, profit_sources (ROI/Daily/Weekly/Level/Monthly), team level_reward. Feeds Dashboard/MyBusiness/TeamReward/WelcomeStatus.
- Verified via curl on DEMO_ROOT: team rank Gold, 10 directs, binary 25/25 $6250 each, qual 4/15; /me cap $3000 ROI $600 level $465.
- NOTE: daily/weekly/monthly pool $ are inflated by accumulated test protocol_stats seed (not a bug; real pools small).
### REMAINING: 10 WalletConnect QR (Project ID); BscScan verify (API key); 5 mainnet (user runbook). All core app now on real data/on-chain.

## [2026-06] A-to-Z verification (user request)
- Engine rank spectrum: demo ROOT bumped to 16 directs -> now Diamond (25/25 binary IDs, $8750/leg, monthly qualified, level $749). All ranks Active->Diamond compute correctly.
- Fresh on-chain full-e2e (testnet, clean): buy/stake cap 200; claim stream-A (level+monthly) 1.477 TTN cap-unchanged price-UP; claim stream-B (ROI+daily+weekly = auto pool) 0.884 TTN cap-unchanged price-UP; sell 3 TTN -> $30.35 cap 200->169.65 price-DOWN. All A-to-Z functions verified.
- CONSTRAINT (honest): true 50-wallet multi-ID ON-CHAIN rank test not run (only 1 funded testnet wallet; can't gas-fund many). Ranks/binary/pools are off-chain calc (unit-tested 105+); on-chain fns are user-agnostic & testnet-proven.

## [2026-08-23] Pool qualification retest + dust-gaming fix
- Testing agent (iteration_15) re-verified FINALIZED daily/weekly/monthly pool qualification end-to-end over live HTTP API: 140 passed, 0 critical.
  - Daily = active + >=1 qualified direct ($50+ own stake) + cap>=$100. Weekly = active + >=5 qualified directs + cap>=$200. Monthly = binary qualification. Confirmed: 1 direct => daily only; 5 directs => daily+weekly; direct staking $40 => neither.
  - DEMO_ROOT monthly_qualified + owner_tier(300% cap $3000) in SAME build run (no 1-run lag), monthly_pool>0 with non-empty Merkle proofs, tree/user root == merkle/latest root.
- FIX (tree_engine.leg_stats): binary leg IDs now count only QUALIFIED active IDs (own stake >= $50), not any active. Closes dust-gaming hole flagged by testing agent (deviation #2). Verified: 20 dust ($1) nodes no longer count; genuine DEMO_ROOT ($350 nodes) still 25 IDs/leg + qualifies.
- OPEN (user decision): testing agent noted the live monthly rule does NOT require a separate Diamond-rank gate (reward_engine.monthly_owner_qualified is stale dead code requiring Diamond). Live rule = 10 directs + $2000 + 25 qualified IDs/leg + $5000/leg, matching user's finalized spec. Left unchanged.

## [2026-08-23] AETHERA reference verified + Pools page wired to real data
- Compared TITAN vs AETHERA live app (user-provided screenshots of Reward Pools). CONFIRMED our pool qualification EXACTLY matches AETHERA live:
  - Daily = 1 direct($50+) + available cap $100; Weekly = 5 directs($50+) + cap $200 (both "Does NOT reduce cap").
  - Monthly = Active + 10 directs + $2000 direct business + 25 QUALIFIED IDs each leg + $5000 carry each leg + on-chain submit. Live app does NOT require a separate Diamond-rank gate -> our engine (no Diamond gate) is correct; resolved the earlier open question.
- NEW backend GET /api/pools/{address}: real per-user pool progress (have/need/ok per requirement), live pool balances, on-chain achievers count (from reward_snapshots breakdown), and estimate = balance/(achievers or achievers+1).
- tree_engine breakdown now includes daily_eligible / weekly_eligible flags.
- PoolsPage.jsx wired to /api/pools/{address}: shows real checklist with green/red per requirement, "All met" vs "N pending" (fixed 0||2 bug), generic info modal per-pool. All pools labelled "Does NOT reduce mining cap" to match deployed contract (claim buys TTN, never reduces cap; only SELL reduces cap). Verified via curl (DEMO_ROOT qualifies all 3) + screenshots.
- NOTE for user: AETHERA infographic slide 10 labels Monthly as "reduces cap", but per your finalized model (only SELL reduces cap) our UI shows Monthly as "Does NOT reduce cap" too, consistent with the contract.

## [2026-08-23] Leadership rank (level income) thresholds aligned to AETHERA
- User-provided AETHERA live "Network & Referral" screen + slide 08 confirmed exact leadership ranks. Fixed reward_engine.RANKS:
  - Star (L2-3): 5 active directs (was 3 + $500)
  - Silver (L4-6): 5 directs + $1000 direct business (unchanged)
  - Gold (L7-9): 10 directs + $2000 direct business (unchanged)
  - Diamond (L10-15): 10 directs + $2000 direct business + $5000 15-level TEAM business (was 15 directs + $5000 direct)
- reward_engine.rank_for() now takes optional team_business_usd; Diamond gated on it.
- tree_engine computes 15-level team business (active downline stake within 15 levels) per user, passes to rank_for, adds team_business_usd to breakdown.
- /team endpoint level reqs updated to match (Star need 5, Diamond need 10/$2000/$5000-team). qualification.unlocked now shows LEVELS unlocked (rank->max_level: Active1/Star3/Silver6/Gold9/Diamond15), tiers_unlocked kept separately.
- Verified: rank_for unit tests, /team DEMO_ROOT = Diamond 15/15 with correct X/Y, MyTeamPage ladder screenshot matches AETHERA, /reward/simulate still correct, level income $749 unchanged (no cascade regression).
- STILL OPEN (needs user decision, flagged earlier): 10% deduction from Direct+Level+Daily+Weekly funding the monthly owner pool (AETHERA slide 08/09/10). Currently monthly pool is a stored value; direct/level don't contribute their 10%.

## [2026-08-23] Monthly Owner pool 10% deduction funding (AETHERA slide 10)
- Implemented monthly pool FUNDING per AETHERA slide 10: 10% deducted from every user's Direct+Level+Daily+Weekly payout (users receive NET 90%); ROI NOT deducted. Pooled 10% + base pool split EQUALLY among Diamond owners.
  - tree_engine: DEDUCT_BPS=1000, net_factor 0.9. Breakdown now has level_income_net_usd, daily/weekly_pool_gross_usd, daily/weekly_pool_usd (net), deducted_to_monthly_usd. monthly_pool_total = base + sum(deductions).
  - monthly_qualified now also requires Diamond rank (slide 10 "Diamond Leader Rank AND...").
  - /api/pools: monthly.balance = base + all deductions; daily/weekly estimate NET (x0.9); monthly estimate no further deduction. PoolsPage info modal explains the 10% funding.
- Bugs found by testing agent (iteration_16) and FIXED:
  - /api/reward/simulate + /api/reward/monthly-qualify now accept team_business_usd and pass it to rank_for/monthly_owner_qualified -> Diamond/Owner-Club reachable again (was silently capped at Gold).
  - /api/me profit_sources 'Level' + /api/team direct/level reward fields now use level_income_net_usd (were gross, over-reported by 10%).
- Verified: full backend suite 171 passed (0 xfail) serially; live curl confirms monthly-qualify->Diamond, simulate->Diamond L15 unlocked, /me sources sum == total.
- Left as-is (minor, simulator-only): reward_engine.pool_contribution() per-stake monthly estimate still models 10% of daily+weekly only (can't know network-wide direct/level from a single stake input); does NOT affect real distribution in tree_engine.

## [2026-08-23] Level income -> STRICT stake-time model (user choice "b", AETHERA "instant")
- tree_engine.compute() level income rewritten: process every stake in ACTIVATION ORDER (activated_at/created_at). An upline earns level% on a downline's stake ONLY IF the upline was already qualified (rank + active) at that moment. Qualifying later does NOT retro-pay past stakes (they stay lapsed). Incremental counters (inc_directs/inc_dbiz/inc_tbiz/inc_active) maintain rank at each stake-time via rank_for.
- Convergence: display rank/qualification still use final all-active state; only level INCOME uses stake-time snapshot. Deterministic across rebuilds (fixed activation order).
- Verified: targeted timing test -> a level-2 stake BEFORE upline reached Star lapses ($3), one AFTER earns ($3); full backend suite 171 passed; DEMO_ROOT level income unchanged ($749, 0 lapsed since root qualifies early).
- CAVEAT (data model): only cumulative total_deposited + single activated_at is stored per user, so each user's stake is treated as ONE event at their activation time. Per-top-up timing is not tracked (would need individual stake_event records). Acceptable for current model; revisit if per-top-up accuracy needed.

## [2026-08-23] Named on-chain claim labels (option 'a') — per-category Merkle
- Each reward type now has its OWN cumulative Merkle leaf + OWN named on-chain function so BscScan shows a clear label per claim. Categories: 0=ROI, 1=Level, 2=Daily, 3=Weekly, 4=Monthly.
- Contract (TitanProtocol.sol): claimRoi / claimLevelIncome / claimDailyPool / claimWeeklyPool / claimMonthlyPool -> internal _claim(uint8 category,...); mapping claimedByCategory[user][category]; leaf = keccak256(bytes.concat(keccak256(abi.encode(user, uint8 category, cumulativeUsd)))); event RewardPoolClaimed(user, category, usdtValue, ttnOut, cumulativeUsd). Removed old claimMerkle + claimedReducing/NonReducing mappings + MerkleClaimed event. Hardhat 12/12 pass (incl per-category independence test).
- Backend: merkle.py leaf types ['address','uint8','uint256']; leaf_hash(address, category, amount_wei); build((address,category,wei)); proofs now {address, category, amount_wei, proof}. tree_engine emits up to 5 category leaves per user. /api/reward/merkle/build MerkleLeaf.category (0-4), dup key (address,category).
- Frontend chain.js: CLAIM_FN map {0:claimRoi,1:claimLevelIncome,2:claimDailyPool,3:claimWeeklyPool,4:claimMonthlyPool}; claimAllRewards loops per-category proofs; new claimCategory(address,category) for per-pool buttons; MiningPage toast lists claimed pool labels.
- Verified: Python Merkle root == @openzeppelin/merkle-tree root (byte-identical) for uint8-category leaves -> on-chain proofs will verify. Backend suite 179 passed (0 failed), iteration_17.
- NOT YET LIVE ON BSCSCAN: the currently DEPLOYED testnet contract still has old claimMerkle. Labels appear only AFTER redeploying the new TitanProtocol (testnet demo or mainnet) + updating config addresses + re-verifying on BscScan.

## [2026-08-25] Per-pool claim buttons + testnet redeploy (named-claim demo LIVE)
- PoolsPage: each pool card's "Claim Share" button now calls claimCategory(address, category) — daily=2->claimDailyPool, weekly=3->claimWeeklyPool, monthly=4->claimMonthlyPool. Busy state + toast with tx hash; refreshes /api/pools after claim.
- Confirmed monthly 10% funding to user: 10% deducted from Direct+Level+Daily+Weekly (NOT self-ROI) -> monthly Owner pool. User gets net 90%. Matches AETHERA slide 10.
- TESTNET REDEPLOY (new named-claim TitanProtocol) on BSC Testnet, all 5 named claims executed live:
  - PROTOCOL=0xc78f03C989Ae4820cCeE94E4A97D66b9605F426D
  - TOKEN=0xC7ed8B984A0b445EcC1f8531CAAb1eB41E5326dB
  - USDT=0x05D9cBf1509A8643972Ac6d136F648686F5aF679
  - SECURITY=0x1C61F12D72b4092DFf6E36F58496bda0fe1f2e24
  - claimRoi tx 0x97527fb3..., claimLevelIncome 0x479cc9db..., claimDailyPool 0xa46c59f3..., claimWeeklyPool 0xe3dfa70e..., claimMonthlyPool 0x5493e65c...
  - Deploy scripts: contracts/scripts/named-claims-testnet.js (deploy+5 claims), retry-claims.js (retry with delays for transient testnet RPC reverts).
- Frontend config.js ONCHAIN.* + frontend/.env REACT_APP_TOKEN_ADDRESS/REACT_APP_MAIN_PROTOCOL_ADDRESS updated to new addresses; frontend restarted. Landing Protocol Ingredients shows new TTN/Mining Engine/USDT.
- PENDING for human-readable labels on BscScan: contract VERIFICATION (needs BSCSCAN_API_KEY). Until verified, BscScan shows raw method selectors instead of "Claim Daily Pool" etc. Functions executed correctly regardless.

## [2026-08-25] BscScan contract verification — ALL GREEN (Etherscan API V2)
- User provided Etherscan API V2 free key (single key works across chains incl BSC). Set BSCSCAN_API_KEY in contracts/.env.
- Installed @nomicfoundation/hardhat-verify@2.1.1 (Hardhat 2 compatible + Etherscan V2). hardhat.config: require hardhat-verify + etherscan.apiKey = single string.
- All 4 testnet contracts VERIFIED (green source on BscScan):
  - TitanToken 0xC7ed8B984A0b445EcC1f8531CAAb1eB41E5326dB (arg: deployer)
  - TitanSecurityAdmin 0x1C61F12D72b4092DFf6E36F58496bda0fe1f2e24 (arg: deployer)
  - TitanProtocol 0xc78f03C989Ae4820cCeE94E4A97D66b9605F426D (args: usdt, ttn, security, signer=deployer, dev=deployer, communityFund=0xdc9F7c..., owner=deployer)
  - CommunityFund 0xdc9F7c6b33B2F1f73c09D66F99f11D70De9C0f08 (no args)
- Named claim/stake/sell functions now render as readable labels on BscScan (Stake, Sell, Claim Roi, Claim Level Income, Claim Daily/Weekly/Monthly Pool).
- Same key + flow reused at mainnet: `npx hardhat verify --network bscMainnet <addr> <args...>`.

## [2026-08-25] Backend root posting + on-chain E2E on VERIFIED testnet contract
- Admin panel flow confirmed wired: "Run Engine" -> POST /reward/tree/build (sets root), "Post Root On-chain" -> adminChain.postMerkleRootOnChain -> protocol.setMerkleRoot. Owner signs via MetaMask.
- Proved end-to-end on verified TitanProtocol 0xc78f03C989Ae4820cCeE94E4A97D66b9605F426D:
  - Posted BACKEND-generated root 0x0d3615...ef5a (193 leaves) on-chain via setMerkleRoot -> rewardEpoch=2. (script scripts/post-and-sell.js)
  - sell(1 TTN): got $10.19 USDT at live price, miningCap 200 -> 189.81 (reduced by EXACTLY the USDT received). Confirms "cap reduces only on sell, by actual USDT". Claims never reduced cap.
  - GOTCHA: public testnet RPC returns STALE reads right after a tx; always re-query fresh (the immediate post-tx accountOf showed 200, a fresh read showed 189.81).
- Full on-chain function set proven working on the verified contract: register, stake, setMerkleRoot, 5 named claims, sell. renew covered by hardhat unit test (needs 200-day elapse, not doable on live testnet).
- REMAINING: in-browser MetaMask click-through E2E is the user's action (needs their wallet + testnet BNB/USDT). Frontend chain.js is wired to these exact verified-contract functions. For REAL users: they register via app -> owner runs engine + posts root -> user claims their category proofs.

## [2026-08-25] Classy success popups + MetaMask test guide + MockUSDT verified
- New /app/frontend/src/lib/notify.jsx -> notifySuccess(title, description): branded green/gold toast (sonner toast.custom + CheckCircle2). Wired at ALL success points:
  - ActivateCard: "Registration Successful" (on register) + "Stake Successful"
  - MiningPage: "Claim Successful" (all rewards), "Sell Successful", "Renewal Successful"
  - PoolsPage: per-pool "<Pool> Claim Successful" (Daily/Weekly/Monthly)
- Verified: frontend compiles clean, app loads (Pools smoke screenshot OK). Actual toast fires on real on-chain action (MetaMask).
- MockUSDT 0x05D9cBf1509A8643972Ac6d136F648686F5aF679 VERIFIED on testnet -> users self-mint test USDT via faucet() on BscScan Write tab.
- Created /app/memory/METAMASK_TESTNET_GUIDE.md (network add, tBNB faucet, USDT mint, connect, register->stake->claim->sell).
- Confirmed lapse mechanism: unqualified upline's level income goes to level_lapsed, NOT claimable by anyone (no roll-up) -> stays in reserve = admin/protocol profit. Matches user intent.
- Carry-forward: intentionally NOT implemented (user said leave it; informational only).

## [2026-08-25] Supply-on-contract (SST/AETHERA trust look) — testnet demo
- Moved 198,903 TTN from deployer EOA -> verified TitanProtocol contract 0xc78f03C989Ae4820cCeE94E4A97D66b9605F426D (tx 0x6f42aeda...). Deployer now holds only 100 TTN.
- BscScan TTN holders now: #1 Protocol contract ~99.45% (verified blue-tick + contract icon), #2 PancakeSwap V2 LP pair, #3 deployer 100 TTN. Matches SST/AETHERA look.
- Mechanism confirmed to user: TTN only leaves the contract when USD/USDT value comes in (claim buys TTN at live price); no one (incl company) can pull it free. MAINNET plan: mint/transfer 99% supply into Protocol at deploy; Protocol -> Safe multisig (NOT renounced, needed for setMerkleRoot); Token renounced; Security kept. Drain-proof + trustless.
- TODO mainnet: bake supply-into-contract into deploy flow (no new token needed; TitanToken already a verified BEP-20).
- Note: stake-time strict level income, 10% monthly deduction, per-category named claims, all contracts verified — all live on testnet.

## ⭐ MAINNET HARD REQUIREMENT (user, 2026-08-25) — SUPPLY DIRECT ON CONTRACT
- On MAINNET, the FULL TTN supply MUST be assigned DIRECTLY to the distribution/Protocol contract AT DEPLOY TIME (mint-to-contract in constructor OR minted-to-contract within the same deploy tx). It must NEVER first land in the deployer EOA and then be transferred.
- REASON (user): a visible "wallet -> contract" transfer on BscScan looks panicky. It must look like the supply was ALWAYS on the contract and distributes FROM there (like SST / AETHERA).
- So BscScan holders on day 1 should show: #1 = Protocol/distribution contract holding ~99% (verified + contract icon), #2 = PancakeSwap V2 LP pair. No initial wallet->contract transfer in history.
- Implementation note: modify TitanToken constructor / deploy script so _mint targets the distribution contract (or deploy token with supply -> immediately used to seed the contract atomically). Protocol -> Safe multisig (NOT renounced, needs setMerkleRoot). Token renounced. Security kept.
- The testnet demo used a post-deploy transfer only because contracts were already deployed — DO NOT do that on mainnet.

## ⭐⭐ MAINNET HARD REQ v2 (user, 2026-08-25) — DIRECT MINT TO CONTRACT (NO wallet->contract transfer)
- User FINAL: mainnet pe token ki PEHLI transaction hi = mint DIRECTLY to the Protocol/distribution contract. NO deployer-wallet-holds-then-transfers. Zero "wallet -> contract" transfer visible on BscScan. Supply "always on contract", fund aana-jaana wahin se.
- APPROVED IMPLEMENTATION (to build + TEST on testnet next session, then re-flatten for Remix):
  1. TitanToken: constructor takes `address mintTo` -> _mint(mintTo, TOTAL_SUPPLY) instead of msg.sender.
  2. TitanProtocol: REMOVE token (ttn) from constructor; add one-time owner `setToken(address)` setter (with require not-already-set). Break circular dependency.
  3. Remix deploy order: (a) deploy TitanProtocol (no token) (b) deploy TitanToken(mintTo = protocol_addr) -> token's FIRST tx = mint to protocol contract (c) protocol.setToken(token) (d) wiring/router/whitelist/community/security (e) keep small TTN for liquidity via a controlled path (f) addLiquidity + LP burn (g) protocol->Safe multisig (h) token renounce.
  4. Update ALL hardhat tests + deploy scripts to new constructor signatures; run `npx hardhat test` (must stay green) + a testnet dry-run; then regenerate contracts/remix-flat/*_flat.sol + update REMIX_DEPLOY_GUIDE.md.
- NOTE: keep a tiny liquidity allocation reachable without a visible wallet->contract transfer (e.g., protocol releases liquidity portion, or mint split: 99% to protocol + 1% liquidity handled inside deploy) — design cleanly next session.
- Everything else already done/verified: stake-time level income, 10% monthly deduction, per-category named claims, 4 contracts verified on testnet, backend 179 tests + hardhat 12 tests green.

## ✅ DONE (2026-06) — DIRECT MINT TO CONTRACT implemented + tested
- TitanProtocol: `ttn` no longer immutable/constructor; added one-time `setToken()` + `seedLiquidity()` (adds LP from contract's OWN held TTN, LP -> dead addr). IPancakeRouter interface got `addLiquidity`.
- TitanToken: unchanged logic (already mints to `treasury` param); now `treasury` = Protocol address.
- Deploy ORDER (deploy.js + REMIX_DEPLOY_GUIDE.md updated): Security -> Community -> Protocol (no token) -> Token(treasury=Protocol) -> setToken -> setRouter -> wiring -> seedLiquidity -> transferOwnership(Safe) -> token renounce last.
- Hardhat: 13 passing incl. new "MAINNET FLOW" test (supply minted straight to protocol, deployer=0, seedLiquidity from contract).
- BSC TESTNET on-chain PROOF (scripts/verify-direct-mint-testnet.js): Protocol=0xd3383c61d3d035753fD44041307F3d259180B658 holds 200000 TTN, deployer wallet=0. Token=0x463C467AFb4CD84992473819A84bae9feE0109eA, deploy tx=0x8c37cc93002962de92e47d14cd4b4496c6fb410e1707c972bdf833fa3b6c14fe. #1 tx = mint to contract, NO wallet->contract transfer.
- Flattened Remix files regenerated: remix-flat/TitanProtocol_flat.sol + TitanToken_flat.sol. Guide rewritten (old 99% transfer instruction REMOVED).
- NOTE: these testnet addresses are throwaway proof contracts; frontend/backend .env NOT changed.

## ✅ FULL RE-TEST on new contract (2026-06) — BSC TESTNET live E2E (scripts/full-e2e-v2.js)
All mechanisms verified on the NEW direct-mint contract (gasPrice 10gwei added to hardhat.config bscTestnet):
- [1] Direct mint: Protocol=200000 TTN, deployer=0 ✓
- [2] Wiring setToken/setRouter/community/security ✓
- [3] seedLiquidity from contract's OWN TTN -> pool price $9.97 ✓
- [4] register + stake $100 -> 200% cap ✓
- [5] Merkle root (5 categories) posted ✓
- [6] All 5 named claims (claimRoi/Level/Daily/Weekly/Monthly) buy TTN live, cap UNCHANGED ✓
- [7] sell -> cap reduced by exact USDT received ✓
Hardhat unit suite: 13/13 pass. No frontend/backend changes needed (claim/stake/sell ABIs unchanged; only Protocol constructor + setToken/seedLiquidity are deploy-time).

## ✅ FINAL (2026-06) — rootPoster role + launch config locked + full testnet E2E
- Added TitanProtocol.rootPoster + setRootPoster(onlyOwner) + setMerkleRoot now callable by owner OR rootPoster (low-power daily reward posting, no fund access). Hardhat: 14/14 pass.
- Mainnet addrs verified on-chain: USDT 0x55d398..7955, PancakeV2 router 0x10ED43..024E, Safe 0xac70aB96..dEB1f (valid Safe proxy).
- LAUNCH CONFIG LOCKED (user, $200 budget, AETHERA mirror): price $0.01/TTN, seed 20,000 TTN + 200 USDT, reserve 180,000, LP burned to dead. Early stakes kept small.
- Live BSC Testnet E2E at exact launch config PASSED (scripts/full-e2e-v2.js): direct mint, seedLiquidity->$0.0100, stake$20->cap$40, rootPoster posts root, all 5 named claims (cap unchanged), sell (cap reduced by exact USDT).
- Re-flattened all 4 remix-flat/*.sol + rewrote REMIX_DEPLOY_GUIDE.md with final numbers + rootPoster step + burn. READY for Remix mainnet deploy.

## ✅ MAINNET DEPLOYED + FRONTEND MAINNET-READY (2026-06)
- BSC MAINNET contracts (deployed by user via Remix, verified on-chain by main agent):
  - TitanSecurityAdmin: 0x833D8A87ae0314aFb48c1b6C80C286708B537a12 (admin = 0xe3501895..7965)
  - CommunityFund: 0x1aB174e3B96615726007115759DD30716759F408
  - TitanProtocol: 0x5A483E367f818202A5fb4E273E93d4cE5dE4EEFD (owner=0xCb64..e0cd)
  - TitanToken (TTN): 0x3430D0DAd0BFedC83335A6c85f917DCc7BB344Bc -> 200,000 TTN ALL on Protocol, deployer wallet=0 ✓ (direct mint verified)
- Wiring DONE on-chain: setToken ✓ setRouter ✓ setRootPoster(0xCb64) ✓ community.setProtocol ✓. setApprovedContract SKIPPED (not required - protocol uses whenActive only).
- Frontend .env + config.js + backend .env switched to MAINNET (chain 56, real addresses, bsc-dataseed RPC, bscscan explorer).
- Added backend/onchain.py (pure urllib JSON-RPC, no web3 dep) -> reads REAL PancakeSwap TTN/USDT pool. dashboard_stats now returns pool_live + real price/liquidity (or not-live). Removed fake $10 price + $4000 LIVE pool. Landing shows "OPENING SOON" until seedLiquidity.
- Domain: titandefi.in (user owns). Needs VPS/server for self-hosting.
- PENDING before launch: (1) seedLiquidity NOT done yet (user will do at launch: 20000 TTN + 200 USDT, price $0.01, LP->dead burn). (2) Other demo stats still present (daily/weekly/monthly pool $3200/$8750/$21400 in DEFAULT_STATS - clean before launch). (3) self-host on VPS + point titandefi.in. (4) transferOwnership(Safe) + token renounce after setup. (5) BscScan verify contracts.

## ✅ PRODUCTION HARDENING + SELF-HOST PREP (2026-06)
- Removed "Demo Wallet (Testnet)" option from WalletModal.jsx. Removed admin "Seed Demo Network" button + doSeed + seedDemoNetwork import + Database icon from AdminPanel.jsx.
- WalletConnect QR ENABLED: REACT_APP_WC_PROJECT_ID=5e7af3babfd0f3ec5f639c3d67bc4be7 (Reown). wallet.js uses chain 56 + bsc-dataseed. Reminder: add titandefi.in to Reown dashboard allowed domains.
- Wiped all demo data (536 users, 854 roots, etc). protocol_stats zeroed. holders endpoint now DB-based (real users). DEFAULT_STATS zeroed.
- SELF-HOST: /app/deploy_vps.sh (Ubuntu 24.04 one-shot: node20, python venv, MongoDB 8.0, nginx, certbot SSL, systemd titan-backend, yarn build) + /app/DEPLOY_VPS.md guide. Server: Hostinger KVM2 187.127.98.41 (root, Ubuntu 24.04, 8GB). Domain: titandefi.in. GitHub repo: https://github.com/cryptoworld55555a-oss/Mahakal-2.0.git
- Backend Merkle root posting still MANUAL (via Remix/script) - backend auto-post w/ rootPoster key is a future task.

## ✅✅ LIVE & DEPLOYED (2026-06) — https://titandefi.in
- Self-hosted on Hostinger VPS 187.127.98.41 (Ubuntu 24.04). Frontend(React build)+Backend(FastAPI systemd titan-backend)+MongoDB 8.0(local)+Nginx+Certbot SSL. All verified: frontend 200, /api/dashboard/stats & /api/holders 200, clean state (0 users, pool_live False).
- Deploy repo: Mahakal-3.0 (had latest code incl onchain.py; 2.0 was stale). Node 22 required (@wallet-standard). Fixed: emergentintegrations stripped from pip (grep -v), port 8001 orphan process killed (fuser -k) - the root cause of routes 404.
- Deploy assets in repo root: deploy_vps.sh (updated: node22, grep-strip emergentintegrations) + DEPLOY_VPS.md.
- REMAINING TO GO FULLY LIVE: (1) seedLiquidity on-chain (20000 TTN + 200 USDT, $0.01, LP->dead) at launch moment. (2) Make Mahakal-3.0 repo PRIVATE again. (3) Add titandefi.in to Reown dashboard allowed domains for WalletConnect QR. (4) Verify 4 contracts on BscScan. (5) transferOwnership->Safe + token renounce after setup.

## ✅ CONTRACT VERIFICATION (2026-06)
- Verified on BscScan (green check + source): TitanToken 0x3430D0..344Bc, TitanProtocol 0x5A483E..EEFD, CommunityFund 0x1aB174..F408 (3/4).
- TitanSecurityAdmin 0x833D8A..7a12 NOT verified - Remix compiled with solc 0.8.34 (not 0.8.24), bytecode/evmVersion mismatch on hardhat verify. Non-critical (block/unblock admin). Can verify via Remix verify plugin later.
- Contracts deployed with solc 0.8.34 in Remix (not 0.8.24). Note for future.
- WalletConnect QR CONFIRMED working on live site (user tested). Project ID active.
