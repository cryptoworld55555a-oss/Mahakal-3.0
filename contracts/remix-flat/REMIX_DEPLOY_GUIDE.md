# TITAN — Mainnet Deploy via Remix + MetaMask (DIRECT MINT TO CONTRACT)

## ✅ Ye version: supply DIRECT smart contract me mint hoti hai
Token ki **PEHLI (number one) transaction hi = mint straight to the Protocol contract.**
Koi "wallet → contract" transfer NAHI dikhega. BscScan pe holder #1 = Protocol contract (📄 verified)
first block se hi. Uske baad #2, #3... transactions wahin contract se aana-jaana karenge.

## Flattened contracts (paste-ready) — is folder me:
- TitanSecurityAdmin_flat.sol
- CommunityFund_flat.sol
- TitanProtocol_flat.sol
- TitanToken_flat.sol

## Remix setup
1. remix.ethereum.org kholo
2. remix-flat/*.sol ka content copy-paste karo (ya GitHub se import)
3. Compiler: **0.8.24**, Enable optimization (**200**) + **"Use viaIR"** ON
4. Deploy tab -> Environment = "Injected Provider - MetaMask", MetaMask ko **BSC MAINNET** pe rakho

## Deploy ORDER (Protocol PEHLE, Token BAAD me — ye hi trick hai)
Har step MetaMask sign karega. Private key kabhi expose nahi hoti.

1. **TitanSecurityAdmin** (arg: `your_deployer_address`)
2. **CommunityFund** (no args)
3. **TitanProtocol** (args, TOKEN address ke BINA):
   - `_usdt` = `0x55d398326f99059fF775485246999027B3197955`  (BSC-USD mainnet)
   - `_security` = TitanSecurityAdmin address (step 1)
   - `_signer` = your backend signer (ya deployer)
   - `_devWallet` = dev wallet
   - `_communityFund` = CommunityFund address (step 2)
   - `_owner` = your deployer address
4. **TitanToken** (arg: `treasury` = **TitanProtocol address from step 3**)
   - 👉 Yahi step pe poori **200,000 TTN supply DIRECT Protocol contract me mint** hoti hai.
   - 👉 Token ka #1 transaction = mint to Protocol. Zero wallet transfer. ✅

## Wiring
5. `protocol.setToken(TitanToken_addr)`   ← token ko protocol se link karo (ek hi baar chalega)
6. `protocol.setRouter(0x10ED43C718714eb63d5aA57B78B54704E256024E)`  (Pancake V2 mainnet router)
7. `community.setProtocol(protocol_addr)`
8. `security.setApprovedContract(protocol_addr, true)`
   - (Protocol pehle se whitelisted hai kyunki token ne use treasury banaya tha.)

## Liquidity — contract ki APNI TTN se, koi personal wallet involve nahi
9. MetaMask me sirf **USDT** rakho liquidity ke liye (TTN protocol ke paas already hai).
10. `usdt.approve(protocol_addr, <usdtAmount>)`
11. `protocol.seedLiquidity(ttnAmount, usdtAmount, DEAD_ADDRESS, deadline)`
    - `ttnAmount` = kitni TTN pool me daalni (protocol ki held supply se jaayegi)
    - `usdtAmount` = utni hi/desired USDT (initial price = usdtAmount/ttnAmount)
    - `DEAD_ADDRESS` = `0x000000000000000000000000000000000000dEaD` → LP tokens seedhe burn → liquidity PERMANENTLY locked
    - `deadline` = future unix timestamp (e.g. now + 3600)
    - 👉 TTN contract → pool jaati hai (contract → router), personal wallet kabhi hold nahi karta.

## Handover + trustless
12. `protocol.transferOwnership(SAFE_MULTISIG)`  — ⚠️ RENOUNCE mat karna: `setMerkleRoot` ke liye owner chahiye. Safe multisig pe do.
13. Security roles → SAFE (ya apne paas rakho block/unblock ke liye)
14. `ttn.renounceOwnership()` — SABSE LAST me (jab whitelist/setup poora ho jaye)

## Verify (BscScan — same free key)
`npx hardhat verify --network bscMainnet <address> <constructor args>`
- TitanProtocol args order: usdt, security, signer, dev, community, owner (TOKEN address NAHI hai ab)
- TitanToken arg: treasury (= protocol address)

## Mainnet time pe chahiye
- BNB (gas) + USDT (liquidity ke liye) MetaMask me
- Safe multisig address (already hai: verify on BSC mainnet before use)

## IMPORTANT
- Testnet addresses ko mainnet pe kabhi reuse mat karna.
- Deploy order strictly: Security → Community → Protocol → Token. (Token last, treasury=Protocol.)
