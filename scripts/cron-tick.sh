#!/usr/bin/env bash
# Daily cron tick — reads CRON_SECRET from .env.local and calls the protected
# /api/cron route. Wire this into a scheduler (systemd timer or crontab):
#   0 23 * * *  /home/invox/invoxai/scripts/cron-tick.sh
set -euo pipefail
cd /home/invox/invoxai
TOKEN=$(grep -E '^CRON_SECRET=' .env.local | head -1 | cut -d= -f2-)
curl -fsS --max-time 120 "http://127.0.0.1:3000/api/cron?token=${TOKEN}" >/dev/null
