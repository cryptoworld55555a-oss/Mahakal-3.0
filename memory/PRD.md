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
