#!/usr/bin/env bash
# ============================================================================
# KPD — разовый setup продакшн-сервера (Ubuntu 22.04/24.04, root).
#
# Что делает (идемпотентно, ничего не удаляет):
#   1. Ставит Node.js 22, git, PostgreSQL 16 (нативно, без Docker)
#   2. Создаёт БД kpd + роль kpd
#   3. Клонирует репозиторий в /opt/kpd/app (ветка main)
#   4. (опция) Импортирует дамп с Neon, если задан NEON_DATABASE_URL и база пуста
#   5. Собирает приложение, применяет схему Prisma
#   6. Создаёт systemd-юнит kpd-frontend (Next.js на 127.0.0.1:3000)
#   7. Подключает домен invoices.kpd.moscow через существующий Traefik
#      (только добавляет dynamic-конфиг, конфиги n8n не трогает)
#   8. Настраивает ежедневный pg_dump-бэкап
#   9. Генерирует SSH-ключ для CI-деплоя и выводит приватный ключ
#
# Запуск:
#   NEON_DATABASE_URL='postgresql://...' bash deploy/server-setup.sh
# ============================================================================
set -euo pipefail

# ── Параметры ───────────────────────────────────────────────────────────────
DOMAIN="${DOMAIN:-invoices.kpd.moscow}"
REPO_URL="${REPO_URL:-https://github.com/Moroz-js/kpd-front.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="/opt/kpd/app"
BACKUP_DIR="/opt/kpd/backups"
DB_NAME="kpd"
DB_USER="kpd"
APP_PORT="3000"
SERVICE_NAME="kpd-frontend"
DEPLOY_KEY="/root/.ssh/kpd_deploy_ed25519"

log()  { echo -e "\033[1;32m[setup]\033[0m $*"; }
warn() { echo -e "\033[1;33m[setup]\033[0m $*"; }
err()  { echo -e "\033[1;31m[setup]\033[0m $*" >&2; }

[ "$(id -u)" -eq 0 ] || { err "Запускать под root"; exit 1; }

# ── 0. Проверка DNS ─────────────────────────────────────────────────────────
SERVER_IP=$(curl -fsS4 --max-time 10 https://ifconfig.me || hostname -I | awk '{print $1}')
DNS_IP=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || true)
if [ -z "$DNS_IP" ]; then
  warn "DNS: $DOMAIN не резолвится. Пропиши A-запись → $SERVER_IP. SSL не выпустится, пока DNS не заработает."
elif [ "$DNS_IP" != "$SERVER_IP" ]; then
  warn "DNS: $DOMAIN → $DNS_IP, а IP сервера $SERVER_IP. Проверь A-запись."
else
  log "DNS ок: $DOMAIN → $SERVER_IP"
fi

# ── 1. Пакеты ───────────────────────────────────────────────────────────────
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  log "Устанавливаю Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
else
  log "Node.js уже установлен: $(node -v)"
fi

apt-get install -y -qq git curl

if ! command -v psql >/dev/null 2>&1; then
  log "Устанавливаю PostgreSQL 16..."
  apt-get install -y -qq postgresql-16 postgresql-client-16 2>/dev/null || apt-get install -y -qq postgresql postgresql-client
else
  log "PostgreSQL уже установлен: $(psql --version)"
fi
systemctl enable --now postgresql

# ── 2. База данных ──────────────────────────────────────────────────────────
DB_PASS_FILE="/opt/kpd/.db_password"
mkdir -p /opt/kpd
if [ -f "$DB_PASS_FILE" ]; then
  DB_PASS=$(cat "$DB_PASS_FILE")
  log "Пароль БД уже сгенерирован ранее"
else
  DB_PASS=$(openssl rand -hex 24)
  echo "$DB_PASS" > "$DB_PASS_FILE"
  chmod 600 "$DB_PASS_FILE"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  log "Создаю роль $DB_USER..."
  sudo -u postgres psql -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS'"
else
  log "Роль $DB_USER уже существует — обновляю пароль"
  sudo -u postgres psql -c "ALTER ROLE $DB_USER LOGIN PASSWORD '$DB_PASS'"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  log "Создаю базу $DB_NAME..."
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
else
  log "База $DB_NAME уже существует"
fi

LOCAL_DB_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

# ── 3. Код ──────────────────────────────────────────────────────────────────
if [ ! -d "$APP_DIR/.git" ]; then
  log "Клонирую $REPO_URL ($BRANCH) в $APP_DIR..."
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  log "Репозиторий уже клонирован — обновляю..."
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi

# ── 4. Импорт дампа с Neon (однократно, только в пустую базу) ────────────────
TABLE_COUNT=$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
# Используем самые свежие установленные pg-бинарники (pg_dump и pg_restore
# должны быть одной версии, иначе «unsupported version in file header»)
pg_bin_dir() { ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1; }
install_pg17_client() {
  warn "Ставлю свежий postgresql-client из PGDG..."
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
  apt-get install -y -qq postgresql-client-17
}

if [ -n "${NEON_DATABASE_URL:-}" ]; then
  if [ "$TABLE_COUNT" = "0" ]; then
    log "Импортирую дамп с Neon..."
    mkdir -p "$BACKUP_DIR"
    NEON_URL_CLEAN=$(echo "$NEON_DATABASE_URL" | sed 's/[?&]channel_binding=[^&]*//')
    DUMP_FILE="$BACKUP_DIR/neon-initial.dump"
    PGBIN=$(pg_bin_dir)
    if ! "$PGBIN/pg_dump" --no-owner --no-privileges --format=custom --file="$DUMP_FILE" "$NEON_URL_CLEAN" 2>/tmp/pgdump.err; then
      if grep -qi "server version mismatch\|aborting because of server version" /tmp/pgdump.err; then
        install_pg17_client
        PGBIN=$(pg_bin_dir)
        "$PGBIN/pg_dump" --no-owner --no-privileges --format=custom --file="$DUMP_FILE" "$NEON_URL_CLEAN"
      else
        cat /tmp/pgdump.err >&2
        err "pg_dump с Neon не удался — база останется пустой (схема применится через prisma db push). Импорт можно повторить, перезапустив скрипт."
        DUMP_FILE=""
      fi
    fi
    if [ -n "$DUMP_FILE" ] && [ -f "$DUMP_FILE" ]; then
      # pg_restore той же (или более новой) версии, что делал дамп
      if ! "$PGBIN/pg_restore" --no-owner --no-privileges --dbname="$LOCAL_DB_URL" "$DUMP_FILE" 2>/tmp/pgrestore.err; then
        if grep -qi "unsupported version" /tmp/pgrestore.err; then
          install_pg17_client
          PGBIN=$(pg_bin_dir)
          "$PGBIN/pg_restore" --no-owner --no-privileges --dbname="$LOCAL_DB_URL" "$DUMP_FILE"
        else
          cat /tmp/pgrestore.err >&2
          exit 1
        fi
      fi
      log "Дамп импортирован (сохранён в $DUMP_FILE)"
    fi
  else
    warn "База $DB_NAME не пуста ($TABLE_COUNT таблиц) — импорт с Neon пропущен"
  fi
else
  [ "$TABLE_COUNT" = "0" ] && warn "NEON_DATABASE_URL не задан — база будет пустой (схема применится через prisma db push)"
fi

# ── 5. .env.local + сборка ──────────────────────────────────────────────────
ENV_FILE="$APP_DIR/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  log "Создаю $ENV_FILE..."
  NEXTAUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
  cat > "$ENV_FILE" <<EOF
# Продакшн-сервер (создано server-setup.sh $(date -Iseconds))
DATABASE_URL=$LOCAL_DB_URL
NEXTAUTH_URL=https://$DOMAIN
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
EOF
  chmod 600 "$ENV_FILE"
else
  log "$ENV_FILE уже существует — не трогаю"
fi

log "npm ci..."
cd "$APP_DIR"
npm ci --no-audit --no-fund

log "Применяю схему Prisma (db push)..."
npm run db:migrate

log "next build..."
npm run build

# ── 6. systemd ──────────────────────────────────────────────────────────────
log "Настраиваю systemd-юнит $SERVICE_NAME..."
cat > "/etc/systemd/system/$SERVICE_NAME.service" <<EOF
[Unit]
Description=KPD frontend (Next.js)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=$(command -v npx) next start -p $APP_PORT -H 127.0.0.1
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
log "Сервис $SERVICE_NAME запущен (127.0.0.1:$APP_PORT)"

# ── 7. Traefik ──────────────────────────────────────────────────────────────
setup_traefik() {
  local DYNAMIC_DIR="" CERT_RESOLVER="" TARGET_IP="127.0.0.1" TRAEFIK_CONTAINER=""

  if command -v docker >/dev/null 2>&1; then
    TRAEFIK_CONTAINER=$(docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null | awk 'tolower($2) ~ /traefik/ {print $1; exit}')
  fi

  if [ -n "$TRAEFIK_CONTAINER" ]; then
    log "Traefik найден в Docker: $TRAEFIK_CONTAINER"
    TARGET_IP=$(docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}' 2>/dev/null || echo "172.17.0.1")

    # certresolver: ищем в лейблах контейнеров (n8n) или в аргументах traefik
    CERT_RESOLVER=$(docker ps -q | xargs -r docker inspect --format '{{range $k,$v := .Config.Labels}}{{$k}}={{$v}}{{"\n"}}{{end}}' 2>/dev/null \
      | grep -oP 'tls\.certresolver=\K\S+' | head -n1 || true)
    if [ -z "$CERT_RESOLVER" ]; then
      CERT_RESOLVER=$(docker inspect "$TRAEFIK_CONTAINER" --format '{{join .Args " "}}' 2>/dev/null \
        | grep -oP 'certificatesresolvers\.\K[^.]+' | head -n1 || true)
    fi

    # Каталог dynamic-конфигов: смонтированный providers.file.directory
    local FILE_DIR_IN_CONTAINER
    FILE_DIR_IN_CONTAINER=$(docker inspect "$TRAEFIK_CONTAINER" --format '{{join .Args " "}}' 2>/dev/null \
      | grep -oP 'providers\.file\.directory=\K\S+' | head -n1 || true)
    if [ -n "$FILE_DIR_IN_CONTAINER" ]; then
      DYNAMIC_DIR=$(docker inspect "$TRAEFIK_CONTAINER" --format \
        "{{range .Mounts}}{{if eq .Destination \"$FILE_DIR_IN_CONTAINER\"}}{{.Source}}{{end}}{{end}}" 2>/dev/null || true)
    fi

    if [ -z "$DYNAMIC_DIR" ]; then
      err "У Traefik в Docker не включён file-provider (providers.file.directory) или каталог не смонтирован."
      err "Добавь traefik'у аргументы: --providers.file.directory=/etc/traefik/dynamic --providers.file.watch=true"
      err "смонтируй каталог с хоста и перезапусти этот скрипт (повторный запуск безопасен)."
      return 1
    fi
  elif [ -d /etc/traefik ]; then
    log "Traefik найден нативный (/etc/traefik)"
    DYNAMIC_DIR="/etc/traefik/dynamic"
    local STATIC=""
    for f in /etc/traefik/traefik.yml /etc/traefik/traefik.yaml; do
      [ -f "$f" ] && STATIC="$f" && break
    done
    if [ -n "$STATIC" ]; then
      CERT_RESOLVER=$(grep -A5 'certificatesResolvers' "$STATIC" 2>/dev/null | grep -oP '^\s{2}\K\w+' | head -n1 || true)
      if ! grep -qE '^\s*file:' "$STATIC"; then
        cp "$STATIC" "$STATIC.bak.$(date +%s)"
        mkdir -p "$DYNAMIC_DIR"
        printf '\nproviders:\n  file:\n    directory: %s\n    watch: true\n' "$DYNAMIC_DIR" >> "$STATIC"
        warn "Включил file-provider в $STATIC (бэкап рядом). Перезапускаю traefik..."
        systemctl restart traefik || true
      fi
    fi
  else
    err "Traefik не найден (ни в Docker, ни в /etc/traefik). Настрой роутинг $DOMAIN → 127.0.0.1:$APP_PORT вручную."
    return 1
  fi

  [ -z "$CERT_RESOLVER" ] && { warn "certresolver не определён — использую 'letsencrypt' (проверь при необходимости)"; CERT_RESOLVER="letsencrypt"; }

  mkdir -p "$DYNAMIC_DIR"
  local CONF="$DYNAMIC_DIR/invoices-kpd.yml"
  if [ -f "$CONF" ]; then
    log "Конфиг Traefik уже существует: $CONF — не трогаю"
  else
    log "Пишу dynamic-конфиг Traefik: $CONF (certresolver=$CERT_RESOLVER, backend=$TARGET_IP:$APP_PORT)"
    cat > "$CONF" <<EOF
# invoices.kpd.moscow → KPD frontend (создано server-setup.sh; конфиги n8n не затронуты)
http:
  routers:
    kpd-invoices:
      rule: "Host(\`$DOMAIN\`)"
      entryPoints:
        - websecure
      service: kpd-invoices
      tls:
        certResolver: $CERT_RESOLVER
    kpd-invoices-http:
      rule: "Host(\`$DOMAIN\`)"
      entryPoints:
        - web
      service: kpd-invoices
  services:
    kpd-invoices:
      loadBalancer:
        servers:
          - url: "http://$TARGET_IP:$APP_PORT"
EOF
  fi

  # Приложение слушает 127.0.0.1 — для docker-traefik нужно слушать gateway-IP
  if [ -n "$TRAEFIK_CONTAINER" ] && [ "$TARGET_IP" != "127.0.0.1" ]; then
    sed -i "s/-H 127.0.0.1/-H 0.0.0.0/" "/etc/systemd/system/$SERVICE_NAME.service"
    systemctl daemon-reload
    systemctl restart "$SERVICE_NAME"
    if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
      ufw deny "$APP_PORT/tcp" >/dev/null 2>&1 || true
      log "ufw: порт $APP_PORT закрыт снаружи (изнутри docker-сети доступен)"
    else
      warn "Приложение слушает 0.0.0.0:$APP_PORT — закрой порт извне файрволом (например: ufw deny $APP_PORT/tcp)"
    fi
  fi
}
setup_traefik || warn "Traefik-шаг не завершён — см. сообщения выше. Остальной setup продолжен."

# ── 8. Бэкапы ───────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
cat > /etc/cron.d/kpd-backup <<EOF
30 3 * * * root pg_dump --format=custom --file=$BACKUP_DIR/kpd-\$(date +\%Y\%m\%d).dump "$LOCAL_DB_URL" && find $BACKUP_DIR -name 'kpd-*.dump' -mtime +14 -delete
EOF
chmod 644 /etc/cron.d/kpd-backup
log "Ежедневный бэкап настроен: $BACKUP_DIR (03:30, хранение 14 дней)"

# ── 9. SSH-ключ для CI ──────────────────────────────────────────────────────
# CI вызывает деплой прямо из репо: bash /opt/kpd/app/deploy/server-deploy.sh
if [ ! -f "$DEPLOY_KEY" ]; then
  log "Генерирую SSH-ключ для CI..."
  mkdir -p /root/.ssh
  ssh-keygen -t ed25519 -N "" -C "kpd-ci-deploy" -f "$DEPLOY_KEY" -q
fi
touch /root/.ssh/authorized_keys
grep -qF "$(cat "$DEPLOY_KEY.pub")" /root/.ssh/authorized_keys || cat "$DEPLOY_KEY.pub" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

# ── Итог ────────────────────────────────────────────────────────────────────
echo
log "════════════════════════════════════════════════════════════"
log "Setup завершён. Приложение: https://$DOMAIN"
log "Статус сервиса:  systemctl status $SERVICE_NAME"
log "Логи:            journalctl -u $SERVICE_NAME -f"
echo
log "GitHub Secrets (repo → Settings → Secrets and variables → Actions):"
log "  SSH_HOST = $SERVER_IP"
log "  SSH_USER = root"
log "  SSH_KEY  = приватный ключ ниже (целиком, включая BEGIN/END):"
echo "────────────────────────────────────────────────────────────"
cat "$DEPLOY_KEY"
echo "────────────────────────────────────────────────────────────"
