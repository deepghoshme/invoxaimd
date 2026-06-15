#!/usr/bin/env bash
# Finishes the deploy: installs Caddy (waiting out any apt lock), applies the
# Caddyfile, opens the firewall, verifies HTTPS. Run as root. Idempotent.
set -euo pipefail
APP_DIR="/home/invox/invoxai"
say() { printf "\n\033[1;33m==> %s\033[0m\n" "$1"; }

# Wait for any other apt/dpkg process to release the lock (max ~3 min).
say "Waiting for apt lock to clear"
for i in $(seq 1 60); do
  if ! fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 \
     && ! fuser /var/lib/apt/lists/lock >/dev/null 2>&1; then
    echo "apt lock is free"; break
  fi
  echo "  apt busy, waiting ($i)…"; sleep 3
done

if ! command -v caddy >/dev/null 2>&1; then
  say "Installing Caddy"
  apt-get update -y
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
else
  say "Caddy already installed ($(caddy version | head -n1))"
fi

say "Applying Caddyfile"
cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable caddy
systemctl restart caddy
sleep 2
systemctl --no-pager --full status caddy | head -n 5 || true

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  say "Opening ports 80 + 443"
  ufw allow 80/tcp
  ufw allow 443/tcp
fi

say "Verifying HTTPS (first hit issues certs, may take ~15s)"
for h in invoxai.io app.invoxai.io admin.invoxai.io; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 40 "https://$h" || echo ERR)
  printf "  https://%-22s -> %s\n" "$h" "$code"
done
say "Caddy step done."
