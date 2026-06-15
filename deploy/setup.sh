#!/usr/bin/env bash
# One-shot deploy for invoxai.io. Run as root:
#     sudo bash /home/invox/invoxai/deploy/setup.sh
#
# Idempotent: safe to re-run. Installs Caddy, runs the Next.js app as a systemd
# service, opens the firewall, and brings the domains up over HTTPS.
set -euo pipefail

APP_USER="invox"
APP_DIR="/home/invox/invoxai"
NODE_BIN="/home/invox/.nvm/versions/node/v20.20.2/bin"

say() { printf "\n\033[1;33m==> %s\033[0m\n" "$1"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo:  sudo bash $APP_DIR/deploy/setup.sh" >&2
  exit 1
fi

# 1. Production build (as the app user, with nvm node on PATH) -----------------
say "Building the app (npm ci && npm run build)"
sudo -u "$APP_USER" env "PATH=$NODE_BIN:/usr/bin:/bin" bash -lc \
  "cd '$APP_DIR' && npm ci && npm run build"

# 2. App service ----------------------------------------------------------------
say "Installing + starting the app service (invoxai-web)"
cp "$APP_DIR/deploy/invoxai-web.service" /etc/systemd/system/invoxai-web.service
systemctl daemon-reload
systemctl enable --now invoxai-web
sleep 2
systemctl --no-pager --full status invoxai-web | head -n 6 || true
curl -s -o /dev/null -w "  app on 127.0.0.1:3000 -> HTTP %{http_code}\n" \
  http://127.0.0.1:3000 || true

# 3. Install Caddy (only if missing) -------------------------------------------
if ! command -v caddy >/dev/null 2>&1; then
  say "Installing Caddy"
  apt-get update -y
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
else
  say "Caddy already installed ($(caddy version | head -n1))"
fi

# 4. Apply the Caddyfile --------------------------------------------------------
say "Applying Caddyfile"
cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable caddy
systemctl restart caddy
sleep 2
systemctl --no-pager --full status caddy | head -n 6 || true

# 5. Firewall -------------------------------------------------------------------
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  say "Opening ports 80 + 443 in ufw"
  ufw allow 80/tcp
  ufw allow 443/tcp
fi

# 6. Verify ---------------------------------------------------------------------
say "Verifying HTTPS (first hit may take ~10s while certs are issued)"
for h in invoxai.io app.invoxai.io admin.invoxai.io; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "https://$h" || echo "ERR")
  printf "  https://%-22s -> %s\n" "$h" "$code"
done

say "Done. If codes above are 200/3xx, your domains are LIVE over HTTPS."
echo "Logs:  journalctl -u invoxai-web -f   |   journalctl -u caddy -f"
