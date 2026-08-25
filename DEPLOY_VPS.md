# TITAN — Self-Host on Hostinger VPS (titandefi.in)

Server: Ubuntu 24.04 LTS · root · 187.127.98.41

## STEP 0 — DNS point karo (pehle ye, propagate hone me time lagta hai)
Domain registrar (jahan se titandefi.in liya) ke DNS settings me:
- **A record**: `@`   → `187.127.98.41`
- **A record**: `www` → `187.127.98.41`
(TTL default. 10 min – 1 ghante me propagate hota hai. Check: https://dnschecker.org → titandefi.in)

## STEP 1 — Code GitHub pe (agar nahi hai)
Emergent chat ke "Save to GitHub" se code push karo. Repo URL note karo.

## STEP 2 — SSH server me
Apne laptop/mobile terminal se:
```
ssh root@187.127.98.41
```
(password Hostinger panel se, ya jo aapne set kiya)

## STEP 3 — Deploy script chalao
```
cd /root
curl -fsSL https://raw.githubusercontent.com/cryptoworld55555a-oss/Mahakal-2.0/main/deploy_vps.sh -o deploy_vps.sh
bash deploy_vps.sh
```
Script sab install karega: Node, Python, MongoDB, Nginx, SSL, build, services.
(10-15 min lagega pehli baar)

## Ho jaane ke baad
- Site: **https://titandefi.in** live
- Backend logs: `journalctl -u titan-backend -f`
- Backend restart: `systemctl restart titan-backend`
- Frontend rebuild: `cd /opt/titan/frontend && yarn build && systemctl reload nginx`

## Agar SSL fail ho (DNS abhi propagate nahi hua tha)
DNS propagate hone ke baad:
```
certbot --nginx -d titandefi.in -d www.titandefi.in
```

## NOTES
- MongoDB local server pe (mongodb://localhost:27017, db=titan_prod) — fresh, khaali.
- Mainnet addresses script me pehle se set hain (Token/Protocol/Community, chain 56).
- Reward Merkle root posting abhi MANUAL hai (Remix/script se), testnet jaisa. Baad me backend auto-posting set kar sakte hain (rootPoster key ke saath).
