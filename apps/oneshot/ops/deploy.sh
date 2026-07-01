#!/usr/bin/env bash
# Redeploy oneshot to the production server. Run from anywhere locally:
#   bash apps/oneshot/ops/deploy.sh
# Override target with env vars if you migrate to a different host/path:
#   ONESHOT_DEPLOY_HOST=new-server ONESHOT_DEPLOY_DIR=~/apps/oneshot bash ops/deploy.sh
set -euo pipefail

SSH_HOST="${ONESHOT_DEPLOY_HOST:-oracle-instance}"
REMOTE_DIR="${ONESHOT_DEPLOY_DIR:-~/apps/oneshot}"

echo "==> Deploying to ${SSH_HOST}:${REMOTE_DIR}"
ssh "$SSH_HOST" "cd ${REMOTE_DIR}/apps/oneshot && git pull --ff-only && docker compose -f ops/docker-compose.yml up -d --build && docker image prune -f"
echo "==> Done. Verify: curl -s https://oneshot.jsyoo.dev/healthz"
