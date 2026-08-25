# TITAN — Mainnet Deploy via Remix + MetaMask

## Flattened contracts (paste-ready) — in this folder:
- TitanToken_flat.sol
- TitanSecurityAdmin_flat.sol
- CommunityFund_flat.sol
- TitanProtocol_flat.sol

## Easiest: open code in Remix from GitHub
1. remix.ethereum.org kholo
2. Left "GitHub" / "Import from GitHub" OR clone plugin -> repo: cryptoworld55555a-oss/Mahakal-
   (ya remix-flat/*.sol files ka content copy-paste karo)
3. Compiler: 0.8.24, Enable optimization (200) + "Use viaIR"
4. Deploy tab -> Environment = "Injected Provider - MetaMask", MetaMask ko BSC MAINNET pe rakho

## Deploy ORDER (MetaMask har step sign karega — key kabhi expose nahi hoti)
1. TitanToken (arg: your_deployer_address)
2. TitanSecurityAdmin (arg: your_deployer_address)
3. CommunityFund (no args)
4. TitanProtocol (args: USDT_mainnet, TTN_addr, security_addr, signer=deployer, dev=deployer, community_addr, owner=deployer)
   - BSC mainnet USDT (BSC-USD): 0x55d398326f99059fF775485246999027B3197955
   - Pancake V2 Router (mainnet): 0x10ED43C718714eb63d5aA57B78B54704E256024E

## Wiring
5. protocol.setRouter(0x10ED43C718714eb63d5aA57B78B54704E256024E)
6. ttn.setWhitelisted(protocol_addr, true)
7. community.setProtocol(protocol_addr)
8. security.setApprovedContract(protocol_addr, true)

## SUPPLY ON CONTRACT (icon requirement)
9. ttn.transfer(protocol_addr, <99% of supply>)  -> holders #1 = Protocol contract (📄 + verified)
   (keep small amount for liquidity in step 10)

## Liquidity + lock
10. approve TTN & USDT to router -> router.addLiquidity(TTN, USDT, amounts...) (set initial price)
11. Get LP token addr from pair -> transfer ALL LP to 0x000000000000000000000000000000000000dEaD (permanent lock)

## Handover + trustless
12. protocol.transferOwnership(SAFE_MULTISIG)  (NOT renounce — setMerkleRoot needed)
13. security roles -> SAFE (or keep with you)
14. ttn.renounceOwnership()  (LAST — after whitelist/setup done)

## Verify (same BscScan key)
npx hardhat verify --network bscMainnet <address> <constructor args>
(add bscMainnet network to hardhat.config with mainnet RPC)

## You need at mainnet time
- Real BNB (gas) + USDT (for liquidity) in MetaMask
- Safe multisig address (already have)
