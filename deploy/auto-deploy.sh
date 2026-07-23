#!/usr/bin/env bash
# Auto-deploy: if origin/main has new commits, pull, rebuild, and verify.
# Runs from cron inside WSL2 Ubuntu every 5 minutes (see RUNBOOK_WSL2.md).
#
# Safety model — a failed deploy must never leave the site down OR silently
# stop deploying:
#   * The previous commit is captured BEFORE the fast-forward. Any failure
#     (merge, build, or health check) rolls the repo back to it and rebuilds
#     the last known-good stack.
#   * The failed commit is recorded in .auto-deploy.failed and skipped from
#     then on, so a bad commit doesn't retry-loop every 5 minutes and spam
#     Telegram. Deploys resume automatically once origin/main moves past it.
#   * Failures and recoveries are pushed to Telegram, because nobody reads
#     a log file they don't know to look at.
set -euo pipefail

REPO="${REPO:-/home/msr/SpeedNet-SystemManagement}"
LOG_DIR="${LOG_DIR:-/mnt/e/deploy/logs}"
LOG="$LOG_DIR/auto-deploy.log"
FAILED_MARK="$REPO/.auto-deploy.failed"

# Health check: how long to give the stack to come up after a rebuild.
HEALTH_TRIES="${HEALTH_TRIES:-20}"
HEALTH_DELAY="${HEALTH_DELAY:-3}"

cd "$REPO"
mkdir -p "$LOG_DIR"

# single-instance lock
exec 9>"$REPO/.auto-deploy.lock"
flock -n 9 || exit 0

compose() {
  docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml "$@"
}

log() { echo "[$(date '+%F %T')] $*" >>"$LOG"; }

# Best-effort Telegram ping, reusing the alerting creds already in .env.
# Never allowed to fail the deploy — notification is not the job.
notify() {
  local tok chat
  tok=$(grep -oP '(?<=^ALERT_TELEGRAM_BOT_TOKEN=).*' .env 2>/dev/null | tr -d '\r' || true)
  chat=$(grep -oP '(?<=^ALERT_TELEGRAM_CHAT_ID=).*' .env 2>/dev/null | tr -d '\r' || true)
  [ -n "${tok:-}" ] && [ -n "${chat:-}" ] || return 0
  curl -sS --max-time 10 -o /dev/null \
    -d "chat_id=$chat" --data-urlencode "text=$1" \
    "https://api.telegram.org/bot${tok}/sendMessage" >>"$LOG" 2>&1 || true
}

# The stack is "up" only when the API answers AND Caddy can reach the frontend.
# Checking the containers are merely running is not enough: the backend runs
# migrations at startup and can die after the container reports Started.
healthy() {
  local i
  for i in $(seq 1 "$HEALTH_TRIES"); do
    if compose exec -T backend python -c \
         "import urllib.request;urllib.request.urlopen('http://localhost:8000/health',timeout=5)" \
         >/dev/null 2>&1 \
       && compose exec -T caddy wget -qO- --timeout=5 http://frontend/ >/dev/null 2>&1; then
      return 0
    fi
    sleep "$HEALTH_DELAY"
  done
  return 1
}

git fetch origin main --quiet
PREV=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$PREV" = "$REMOTE" ] && exit 0

# Already tried this exact commit and it broke — stay on the good version and
# stay quiet until someone pushes a fix.
if [ -f "$FAILED_MARK" ] && [ "$(cat "$FAILED_MARK")" = "$REMOTE" ]; then
  exit 0
fi

rollback() {
  local why="$1"
  log "DEPLOY FAILED ($why) — rolling back to $PREV"
  echo "$REMOTE" >"$FAILED_MARK"
  git reset --hard "$PREV" >>"$LOG" 2>&1 || true
  if compose up -d --build >>"$LOG" 2>&1 && healthy; then
    log "rolled back to $(git rev-parse --short HEAD) — site is up"
    notify "🚨 SPEEDNeT deploy FAILED ($why)
Commit $(git rev-parse --short "$REMOTE") is NOT live.
Rolled back to $(git rev-parse --short HEAD) — site is UP.
Auto-deploy is paused until a new commit lands."
  else
    log "ROLLBACK ALSO FAILED — manual intervention needed"
    notify "🔥 SPEEDNeT deploy FAILED ($why) and the ROLLBACK ALSO FAILED.
The site may be DOWN. Manual fix needed on the server.
Log: $LOG"
  fi
  exit 1
}

log "new commits detected: $PREV -> $REMOTE"
git log --oneline "$PREV..$REMOTE" >>"$LOG" 2>&1 || true

git merge --ff-only origin/main >>"$LOG" 2>&1 || rollback "git merge (history diverged?)"
compose up -d --build >>"$LOG" 2>&1 || rollback "docker build"
healthy || rollback "health check"

log "deploy complete at $(git rev-parse --short HEAD)"

# Recovering from a previously failed deploy is worth saying out loud.
if [ -f "$FAILED_MARK" ]; then
  rm -f "$FAILED_MARK"
  notify "✅ SPEEDNeT deploy recovered — now live at $(git rev-parse --short HEAD)."
fi
