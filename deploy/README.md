# Деплой KPD

## Схема

| Ветка | Куда | БД |
|---|---|---|
| `dev` | Vercel | Neon |
| `main` | Сервер, https://invoices.kpd.moscow | PostgreSQL на сервере |

На сервере также работает n8n (autof.kpd.moscow) за Traefik — setup его не трогает,
только добавляет свой dynamic-конфиг Traefik.

## Разовый setup сервера

Требования: Ubuntu 22.04/24.04, root по SSH, A-запись `invoices.kpd.moscow` → IP сервера.

```bash
ssh root@<server>
git clone https://github.com/Moroz-js/kpd-front.git /tmp/kpd-setup
NEON_DATABASE_URL='postgresql://...' bash /tmp/kpd-setup/deploy/server-setup.sh
```

- `NEON_DATABASE_URL` — строка подключения Neon (из `.env.production`); если задана и
  локальная база пуста — данные будут перенесены дампом (`pg_dump` → `pg_restore`).
- Скрипт идемпотентный: повторный запуск безопасен, ничего не удаляет и не перезатирает.
- В конце скрипт выведет приватный SSH-ключ для CI.

## GitHub Secrets (для CI)

Repo → Settings → Secrets and variables → Actions:

| Secret | Значение |
|---|---|
| `SSH_HOST` | IP сервера (выводится в конце setup) |
| `SSH_USER` | `root` |
| `SSH_KEY` | приватный ключ из вывода setup (целиком, включая BEGIN/END) |

После этого каждый push в `main` запускает `.github/workflows/deploy.yml`:
проверка типов → SSH → `/opt/kpd/deploy.sh` (pull, build, `prisma db push`, restart).

## Переключение Vercel на ветку dev

1. Создать ветку: `git checkout -b dev && git push -u origin dev`
2. Vercel Dashboard → проект → Settings → Git → Production Branch → `dev`

После этого пуши в `dev` деплоятся на Vercel (Neon), пуши в `main` — на сервер.

## Полезное на сервере

```bash
systemctl status kpd-frontend       # статус
journalctl -u kpd-frontend -f       # логи
/opt/kpd/deploy.sh                  # ручной деплой
ls /opt/kpd/backups                 # дампы БД (ежедневно 03:30, 14 дней)
cat /opt/kpd/.db_password           # пароль postgres-роли kpd
```

Конфиг приложения на сервере: `/opt/kpd/app/.env.local`
(локальный `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`) — в git не попадает.
