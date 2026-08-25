# TITAN — MetaMask Testnet Test Guide (BSC Testnet)

App: https://ttn-reward-engine.preview.emergentagent.com
Explorer: https://testnet.bscscan.com

## Verified contracts (BSC Testnet)
- TitanProtocol (Mining Engine): 0xc78f03C989Ae4820cCeE94E4A97D66b9605F426D
- TitanToken (TTN): 0xC7ed8B984A0b445EcC1f8531CAAb1eB41E5326dB
- MockUSDT (test USDT): 0x05D9cBf1509A8643972Ac6d136F648686F5aF679
- TitanSecurityAdmin: 0x1C61F12D72b4092DFf6E36F58496bda0fe1f2e24

## Step 1 — MetaMask me BSC Testnet add karo
Network name: BSC Testnet | RPC: https://data-seed-prebsc-1-s1.bnbchain.org:8545 | Chain ID: 97 | Symbol: tBNB | Explorer: https://testnet.bscscan.com

## Step 2 — Test BNB (gas) lो
Faucet: https://www.bnbchain.org/en/testnet-faucet — apna address daalke tBNB claim karo (gas ke liye).

## Step 3 — Test USDT mint karo (self-service)
1. Kholo: https://testnet.bscscan.com/address/0x05D9cBf1509A8643972Ac6d136F648686F5aF679#writeContract
2. "Connect to Web3" → MetaMask connect
3. `faucet` function → amount = `1000000000000000000000` (= 1000 USDT, 18 decimals) → Write → confirm
4. MetaMask me TTN + USDT token import kar sakte ho (upar ke addresses se)

## Step 4 — App pe connect + Register + Stake
1. App kholo → Connect Wallet (MetaMask) → BSC Testnet pe raho
2. Activate/Stake card → amount daalo (min $10, multiple of step) → Stake
   - MetaMask 2 baar poochega: (a) USDT approve (b) Stake — dono confirm
   - 60% se TTN buy + 5% dev + 35% reserve; mining cap = stake × 200%

## Step 5 — Claim (owner ko root post karna hoga)
Claim tabhi enable hoga jab aapke reward compute ho + owner ne root post kiya ho:
1. Admin panel (/admin) → owner wallet connect → **Run Engine** → **Post Root On-chain**
2. Ab Mining/Pools page pe Claim button enable → har category alag: Claim ROI / Level / Daily / Weekly / Monthly
3. BscScan pe tx ka method clear naam se dikhega (contract verified hai)

## Step 6 — Sell
Mining/Pools se TTN mila hoga. Sell card → TTN amount → Sell.
- TTN → USDT (live PancakeSwap price). Mining cap **actual USDT received ke barabar kam** hota hai (claim se cap kam nahi hota, sirf sell se).

## Notes
- Public testnet RPC kabhi-kabhi purana (stale) balance dikhata hai — 5-10 sec baad refresh karo.
- Renew: 200 din baad hi due hota hai (testnet pe wait nahi kar sakte; logic unit-test se verified).
- Lapsed level income (jab upline qualify na ho) kisi ko nahi milta — reserve me rehta hai (admin profit).
