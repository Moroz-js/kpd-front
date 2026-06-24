# КПД — frontend

Next.js-приложение для учёта проектов, смет, выплат и кэшфлоу.

## Локальная разработка

```bash
cp .env.example .env
npm install
npm run db:push
npm run db:seed   # демо-данные (SQLite)
npm run dev
```

## База данных

| Команда | Назначение |
|---------|------------|
| `npm run db:push` | Синхронизировать схему (локально SQLite) |
| `npm run db:migrate` | `db push` в Neon (нужен `DATABASE_URL` postgres) |
| `npm run db:reset` | Сброс БД + seed |
| `npm run db:seed` | Заполнить демо-данными |

Импорт из Excel (прод):

```bash
node scripts/migrate-excel.mjs              # preview
node scripts/migrate-excel.mjs --run        # локально
node scripts/migrate-excel.mjs --run --production
```

Доступы после импорта → `scripts/import-credentials.txt` (в gitignore).

## Деплой

Vercel + Neon PostgreSQL. Схему в Neon применять отдельно: `npm run db:migrate` с prod `DATABASE_URL`.
