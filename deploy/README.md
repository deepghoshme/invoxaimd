# Deploy — invoxai.io (Hostinger KVM2 VPS)

DNS is already live: apex, `www`, `app`, `admin`, and the wildcard `*.invoxai.io`
all point to this VPS (`93.127.195.147`). These steps put the app behind Caddy
with automatic HTTPS.

Run each block in the Claude Code prompt with a leading `!` (e.g. `! sudo …`) so
the output lands in the session, or paste into an SSH shell. They need sudo.

## 1. Build the app (no sudo)

```bash
cd /home/invox/invoxai
npm ci
npm run build
```

## 2. Install + run the app as a service

```bash
sudo cp /home/invox/invoxai/deploy/invoxai-web.service /etc/systemd/system/invoxai-web.service
sudo systemctl daemon-reload
sudo systemctl enable --now invoxai-web
sudo systemctl status invoxai-web --no-pager
```

App should now answer on `127.0.0.1:3000`. Verify:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000
```

## 3. Install Caddy

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

## 4. Apply the Caddyfile

```bash
sudo cp /home/invox/invoxai/deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

## 5. Open the firewall (if ufw is active)

```bash
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
```

## 6. Verify HTTPS end to end

```bash
curl -sI https://invoxai.io        | head -1
curl -sI https://app.invoxai.io    | head -1
curl -sI https://admin.invoxai.io  | head -1
# A claimed seller subdomain (after onboarding creates one) should also get a cert:
# curl -sI https://<subdomain>.invoxai.io | head -1
```

## How TLS works here

- `app` / `admin` / apex / `www` get certs immediately (they're in the Caddyfile).
- Any other hostname (a seller subdomain `name.invoxai.io`, or a custom domain)
  triggers **on-demand TLS**: Caddy first calls `GET /api/tls-check?domain=<host>`
  and only issues a cert if the app returns `200`. The route allows a host when it
  matches a claimed `stores.subdomain` or a verified `stores.custom_domain`. So an
  unclaimed/random subdomain is refused — protecting the Let's Encrypt rate limit.

## Redeploy after code changes

```bash
cd /home/invox/invoxai && git pull && npm ci && npm run build && sudo systemctl restart invoxai-web
```
