# TITAN — Mainnet Deploy via Remix + MetaMask (FINAL)

## ✅ Ye version: supply DIRECT contract me mint + LP burn + rootPoster operator
- Token ki **PEHLI transaction hi = 200,000 TTN mint straight to Protocol contract.** Koi wallet→contract transfer NAHI.
- Liquidity contract ki apni TTN se seed hoti hai; LP tokens **dead address me burn** → permanently locked.
- Daily reward roots ek alag **rootPoster** wallet se post honge (multisig approval ki zaroorat nahi). rootPoster funds nahi chhoo sakta.
- ⚡ TESTED live on BSC Testnet at exact launch config ($0.01, $200, LP burn, rootPoster) — sab kaam kar raha hai.

## 🎯 FINAL LAUNCH NUMBERS (locked)
- Launch price: **$0.01 / TTN**
- Pool seed: **20,000 TTN + 200 USDT** (aapka asli kharcha = sirf $200; TTN free from supply)
- Reserve: **180,000 TTN** Protocol me
- LP receiver: **0x000000000000000000000000000000000000dEaD** (burn)

## Mainnet addresses (verified)
- BSC-USD (USDT): `0x55d398326f99059fF775485246999027B3197955`
- PancakeSwap V2 Router: `0x10ED43C718714eb63d5aA57B78B54704E256024E`
- Safe multisig (aapka): `0xac70aB96CF6bB4AfB28dE85932267dac995dEB1f`
- Dead (burn): `0x000000000000000000000000000000000000dEaD`

## Flattened contracts (is folder me, paste-ready)
- TitanSecurityAdmin_flat.sol
- CommunityFund_flat.sol
- TitanProtocol_flat.sol
- TitanToken_flat.sol

## Remix setup
1. remix.ethereum.org kholo
2. Har *.sol ka content ek naye file me paste karo
3. Compiler: **0.8.24**, Optimization **ON (200)**, **"Use viaIR" ON**
4. Deploy tab -> Environment = "Injected Provider - MetaMask", MetaMask **BSC MAINNET** pe

## Deploy ORDER (Protocol PEHLE, Token BAAD me — yahi trick hai)
Har step MetaMask sign karega. Private key kabhi expose nahi hoti.

1. **TitanSecurityAdmin** — arg: `admin` = your_deployer_address
2. **CommunityFund** — no args
3. **TitanProtocol** — args (TOKEN address ke BINA):
   - `_usdt`        = `0x55d398326f99059fF775485246999027B3197955`
   - `_security`    = TitanSecurityAdmin address (step 1)
   - `_signer`      = backend signer wallet (ya deployer)
   - `_devWallet`   = dev wallet
   - `_communityFund` = CommunityFund address (step 2)
   - `_owner`       = your deployer address
4. **TitanToken** — arg: `treasury` = **TitanProtocol address (step 3)**
   - 👉 Yahi pe poori 200,000 TTN DIRECT Protocol me mint. Token ka #1 tx = mint to contract. ✅

## Wiring
5. `protocol.setToken(<TitanToken address>)`     (ek hi baar chalega)
6. `protocol.setRouter(0x10ED43C718714eb63d5aA57B78B54704E256024E)`
7. `community.setProtocol(<TitanProtocol address>)`
8. `security.setApprovedContract(<TitanProtocol address>, true)`
9. `protocol.setRootPoster(<backend rootPoster wallet>)`  ← daily reward posting wallet (low-power)

## Liquidity — contract ki APNI TTN se, LP BURN
10. MetaMask me **$200 USDT** rakho.
11. `usdt.approve(<TitanProtocol address>, 200000000000000000000)`   (= 200 USDT, 18 decimals)
12. `protocol.seedLiquidity(ttnAmount, usdtAmount, lpReceiver, deadline)`:
    - `ttnAmount`  = `20000000000000000000000`   (20,000 TTN)
    - `usdtAmount` = `200000000000000000000`      (200 USDT)
    - `lpReceiver` = `0x000000000000000000000000000000000000dEaD`  (LP burn = liquidity locked forever)
    - `deadline`   = abhi ka unix time + 1200 (e.g. https://www.unixtimestamp.com se lo)
    - 👉 Price = 200/20000 = **$0.01/TTN**. TTN contract→pool jaati hai (personal wallet involved nahi).

## Handover + trustless (SETUP KE BAAD)
13. `protocol.transferOwnership(0xac70aB96CF6bB4AfB28dE85932267dac995dEB1f)` — Safe multisig.
    ⚠️ RENOUNCE mat karna — `setRootPoster`/admin ke liye owner chahiye. Safe pe rakhо.
14. `ttn.renounceOwnership()` — SABSE LAST me (jab whitelist/setup poora ho jaye).

## Verify (BscScan — same free key)
`npx hardhat verify --network bscMainnet <address> <constructor args>`
- TitanProtocol args: usdt, security, signer, dev, community, owner (TOKEN address NAHI)
- TitanToken arg: treasury (= protocol address)

## Launch tips
- Pehle 2-3 din **stakes chhote rakho ($10-$20)** → $200 pool pe price smooth upar jayega.
- rootPoster wallet me sirf gas (BNB) rakho; wo funds nahi chhoo sakta.

## IMPORTANT
- Testnet addresses mainnet pe reuse mat karna.
- Deploy order strictly: Security → Community → Protocol → Token (Token last, treasury=Protocol).
