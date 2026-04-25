#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   DEPLOY_HOST=user@droplet.host DEPLOY_PATH=/srv/pulse-backend ./scripts/deploy.sh
# Requires SSH key auth; runs from the backend/ directory.

: "${DEPLOY_HOST:?DEPLOY_HOST is required (e.g. user@droplet.host)}"
: "${DEPLOY_PATH:=/srv/pulse-backend}"

echo "==> Building"
npm run build

echo "==> Syncing to ${DEPLOY_HOST}:${DEPLOY_PATH}"
rsync -avz --delete \
  --exclude node_modules \
  --exclude .env \
  --exclude .env.local \
  --exclude test \
  dist/ package.json package-lock.json deploy/ scripts/ \
  "${DEPLOY_HOST}:${DEPLOY_PATH}/"

echo "==> Installing prod deps + restarting service"
ssh "${DEPLOY_HOST}" "cd ${DEPLOY_PATH} && npm ci --omit=dev && sudo systemctl restart pulse-backend && sleep 1 && systemctl is-active pulse-backend"

echo "==> Running smoke test"
"$(dirname "$0")/smoke.sh"

echo "==> Deploy OK"
