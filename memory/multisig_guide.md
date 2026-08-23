# TITAN Multisig (Gnosis Safe) Setup — for Protocol + Security admin control

## Why: Protocol + Security contracts CANNOT be renounced (need ongoing block/pause/Merkle-root ops).
Their single admin key is the last risk (compromise = drain USDT reward reserve via fake root, or pause/grief).
Multisig (2-of-3) secures it: one leaked key is not enough.
(Token = renounce; Liquidity = LP burn; Protocol/Security = multisig.)

## Create Safe (user does this on mainnet):
- Link: https://app.safe.global
- Connect MetaMask -> select "BNB Smart Chain" -> Create new Safe
- Add 3 owner addresses (3 separate wallets), threshold 2-of-3
- Confirm (needs ~$3-5 BNB gas) -> get Safe address (0x...)

## User gives main agent: the Safe address (0x...) only.

## Then main agent does (mainnet):
- Protocol (Ownable): transferOwnership(SAFE)
- Security (AccessControl): grantRole(ADMIN_ROLE, SAFE) + grantRole(DEFAULT_ADMIN_ROLE, SAFE), then renounce old admin roles
- Wire admin panel to connect Safe (WalletConnect) or use Safe Transaction Builder to call contract fns

## Mainnet order: deploy -> add liquidity -> LP burn (lock) -> create Safe -> transfer Protocol+Security to Safe -> renounce TTN token ownership (last).

## USER-PROVIDED SAFE ADDRESS (for mainnet admin control):
SAFE_ADDRESS = 0xac70aB96CF6bB4AfB28dE85932267dac995dEB1f
- At MAINNET deploy: transferOwnership(SAFE) on Protocol; grant ADMIN_ROLE+DEFAULT_ADMIN_ROLE to SAFE on Security then renounce old roles.
- DO NOT transfer TESTNET ownership to this Safe (Safe only exists on BSC mainnet; testnet has no Safe to sign -> would lock testnet admin).
