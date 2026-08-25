#!/usr/bin/env bash
###############################################################################
# TITAN (TTN) — One-shot VPS deploy for Ubuntu 24.04 LTS (Hostinger KVM)
# Frontend (React build) + Backend (FastAPI) + MongoDB + Nginx + SSL
# Run as root:  bash deploy_vps.sh
###############################################################################
set -euo pipefail

# ============ EDIT THESE 2 LINES BEFORE RUNNING ============
REPO_URL="https://github.com/cryptoworld55555a-oss/Mahakal-2.0.git"   # aapka GitHub repo
DOMAIN="titandefi.in"
# ===========================================================

APP_DIR="/opt/titan"
DB_NAME="titan_prod"

echo "==> [1/9] System update + base packages"
apt-get update -y
apt-get install -y nginx git curl gnupg python3-venv python3-pip ufw \
  certbot python3-certbot-nginx build-essential

echo "==> [2/9] Node.js 20 + Yarn"
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
corepack enable || npm install -g yarn

echo "==> [3/9] MongoDB 8.0"
if ! command -v mongod >/dev/null; then
  curl -fsSL https://pgp.mongodb.com/server-8.0.asc | gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-8.0.list
  apt-get update -y
  apt-get install -y mongodb-org
fi
systemctl enable --now mongod

echo "==> [4/9] Clone / update repo"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull
else
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

echo "==> [5/9] Backend .env + venv"
cat > "$APP_DIR/backend/.env" <<EOF
MONGO_URL="mongodb://localhost:27017"
DB_NAME="$DB_NAME"
CORS_ORIGINS="https://$DOMAIN"
CHAIN_ID="56"
TOTAL_SUPPLY="200000"
TOKEN_ADDRESS="0x3430D0DAd0BFedC83335A6c85f917DCc7BB344Bc"
MAIN_PROTOCOL_ADDRESS="0x5A483E367f818202A5fb4E273E93d4cE5dE4EEFD"
REWARD_ENGINE_ADDRESS="0x0000000000000000000000000000000000000000"
POOL_MANAGER_ADDRESS="0x0000000000000000000000000000000000000000"
COMMUNITY_FUND_ADDRESS="0x1aB174e3B96615726007115759DD30716759F408"
BSC_RPC_URL="https://bsc-dataseed.binance.org"
EOF

cd "$APP_DIR/backend"
python3 -m venv venv
./venv/bin/pip install --upgrade pip
grep -v emergentintegrations requirements.txt > r.txt
./venv/bin/pip install -r r.txt

echo "==> [6/9] Backend systemd service"
cat > /etc/systemd/system/titan-backend.service <<EOF
[Unit]
Description=TITAN FastAPI backend
After=network.target mongod.service

[Service]
WorkingDirectory=$APP_DIR/backend
ExecStart=$APP_DIR/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now titan-backend

echo "==> [7/9] Frontend .env + build"
cat > "$APP_DIR/frontend/.env" <<EOF
REACT_APP_BACKEND_URL=https://$DOMAIN
REACT_APP_CHAIN_ID=56
REACT_APP_WC_PROJECT_ID=5e7af3babfd0f3ec5f639c3d67bc4be7
REACT_APP_TOKEN_ADDRESS=0x3430D0DAd0BFedC83335A6c85f917DCc7BB344Bc
REACT_APP_MAIN_PROTOCOL_ADDRESS=0x5A483E367f818202A5fb4E273E93d4cE5dE4EEFD
EOF
cd "$APP_DIR/frontend"
yarn install --frozen-lockfile || yarn install
yarn build

echo "==> [8/9] Nginx config"
cat > /etc/nginx/sites-available/titan <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root $APP_DIR/frontend/build;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        try_files \$uri /index.html;
    }
}
EOF
ln -sf /etc/nginx/sites-available/titan /etc/nginx/sites-enabled/titan
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo "==> [9/9] Firewall + SSL"
ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
yes | ufw enable || true
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" --redirect || \
  echo "!! SSL step skipped/failed — DNS point hone ke baad 'certbot --nginx -d $DOMAIN' dobara chalao"

echo ""
echo "======================================================================"
echo " DONE! Site: https://$DOMAIN"
echo " Backend logs : journalctl -u titan-backend -f"
echo " Restart back : systemctl restart titan-backend"
echo " Rebuild front: cd $APP_DIR/frontend && yarn build && systemctl reload nginx"
echo "======================================================================"
