#!/usr/bin/env bash
# OneShot dev setup — run after `git pull` on a fresh machine.
#   bash apps/oneshot/setup.sh
# Installs deps and creates the (git-ignored) .env files from the
# committed .env.example templates so the server/client can boot.
set -e
cd "$(dirname "$0")"

echo "==> Installing dependencies (pnpm)…"
corepack pnpm install

for pkg in server client; do
  if [ ! -f "$pkg/.env" ]; then
    cp "$pkg/.env.example" "$pkg/.env"
    echo "==> Created $pkg/.env from $pkg/.env.example"
  else
    echo "==> $pkg/.env already exists — left as is"
  fi
done

echo ""
echo "Done. Start dev with:"
echo "  corepack pnpm --filter @oneshot/server dev    # http://localhost:2567"
echo "  corepack pnpm --filter @oneshot/client dev    # http://localhost:5173"
