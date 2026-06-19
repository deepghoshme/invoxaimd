#!/usr/bin/env bash
# Cron tick — reads CRON_SECRET from .env.local and calls the protected /api/cron
# route. Optional $1 = job (all | recovery | audit | subscriptions | wallet_report).
# Wire into a scheduler (user crontab):
#   0 23 * * *  /home/invox/invoxai/scripts/cron-tick.sh all
#   1 12 * * *  /home/invox/invoxai/scripts/cron-tick.sh wallet_report
set -euo pipefail
cd /home/invox/invoxai
JOB="${1:-all}"
TOKEN=$(grep -E '^CRON_SECRET=' .env.local | head -1 | cut -d= -f2-)
curl -fsS --max-time 120 "http://127.0.0.1:3000/api/cron?token=${TOKEN}&job=${JOB}" >/dev/null
