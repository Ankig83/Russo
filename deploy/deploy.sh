#!/usr/bin/env bash
# Сборка и выкладка на VPS Beget по SSH.
# Использование:
#   DEPLOY_HOST=user@123.45.67.89 DEPLOY_PATH=/var/www/russo ./deploy/deploy.sh

set -euo pipefail

HOST="${DEPLOY_HOST:?Укажи DEPLOY_HOST=user@ip}"
PATH_ON_SERVER="${DEPLOY_PATH:-/var/www/russo}"

echo "→ npm ci && npm run build"
npm ci
npm run build

echo "→ rsync dist/ → ${HOST}:${PATH_ON_SERVER}/"
rsync -avz --delete \
  --exclude '.git' \
  dist/ "${HOST}:${PATH_ON_SERVER}/"

echo "✓ Готово: https://YOUR_DOMAIN.ru"
