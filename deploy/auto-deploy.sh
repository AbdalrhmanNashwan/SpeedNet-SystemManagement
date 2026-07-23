#!/usr/bin/env bash
# Auto-deploy: if origin/main has new commits, pull and rebuild the stack.
# Runs from cron inside WSL2 Ubuntu every 5 minutes (see RUNBOOK_WSL2.md).
# Safe to run constantly: exits immediately when there's nothing new, and a
# lock file prevents two runs from overlapping (a build takes > 5 min cold).
set -euo pipefail

REPO="${REPO:-/home/msr/SpeedNet-SystemManagement}"
LOG_DIR="${LOG_DIR:-/mnt/e/deploy/logs}"
LOG="$LOG_DIR/auto-deploy.log"

cd "$REPO"
mkdir -p "$LOG_DIR"

# single-instance lock
exec 9>"$REPO/.auto-deploy.lock"
flock -n 9 || exit 0

git fetch origin main --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0

{
  echo "[$(date '+%F %T')] new commits detected: $LOCAL -> $REMOTE"
  git log --oneline "$LOCAL..$REMOTE"
  # ff-only: never auto-merge; if history diverged (someone committed on the
  # server), stop and leave it for a human instead of guessing.
  git merge --ff-only origin/main
  docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
  echo "[$(date '+%F %T')] deploy complete at $(git rev-parse --short HEAD)"
} >>"$LOG" 2>&1
