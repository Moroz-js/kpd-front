#!/usr/bin/env bash
# ============================================================================
# KPD — обновление приложения на сервере (вызывается CI или вручную).
# Установлен в /opt/kpd/deploy.sh скриптом server-setup.sh.
# ============================================================================
set -euo pipefail

APP_DIR="/opt/kpd/app"
BRANCH="${BRANCH:-main}"
SERVICE_NAME="kpd-frontend"

echo "[deploy] Обновляю код ($BRANCH)..."
cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "[deploy] npm ci..."
npm ci --no-audit --no-fund

echo "[deploy] Применяю схему Prisma..."
npm run db:migrate

echo "[deploy] next build..."
npm run build

echo "[deploy] Перезапускаю $SERVICE_NAME..."
systemctl restart "$SERVICE_NAME"

sleep 3
if systemctl is-active --quiet "$SERVICE_NAME"; then
  echo "[deploy] OK: $SERVICE_NAME запущен ($(git rev-parse --short HEAD))"
else
  echo "[deploy] FAIL: сервис не поднялся, смотри: journalctl -u $SERVICE_NAME -n 50" >&2
  exit 1
fi
