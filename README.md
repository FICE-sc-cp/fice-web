# FICE Web

Website for the **FICE student council** — public information about the
council's activity (departments, events, fundraisers, partners) plus forms to
**apply as a partner** or **join the council**. All visual content is managed by
admins through a **Telegram Mini App**, backed by a NestJS API.

| Layer | Technology |
|-------|-----------|
| **Public site** (`client/web`) | Next.js |
| **Admin panel** (`client/admin`) | Next.js + Telegram Mini App SDK |
| **API + bot** (`server`) | NestJS, grammY |
| **Database** | PostgreSQL |
| **ORM** | Prisma |
| **Language** | TypeScript |

---

## Table of Contents

- [Architecture](#architecture)
- [Quick Start (Docker)](#quick-start-docker)
- [Local Development](#local-development)
  - [Server](#server)
  - [Public web client](#public-web-client)
  - [Admin Telegram Mini App](#admin-telegram-mini-app)
- [Environment Variables](#environment-variables)
- [Production Deploy](#production-deploy)
- [API Overview](#api-overview)
- [Database & Prisma](#database--prisma)
- [Project Structure](#project-structure)
- [Links](#links)

---

## Architecture

```
                 ┌──────────────┐         ┌──────────────┐
   public users  │  web (3002)  │         │ admin (3000) │  council admins
                 │  Next.js     │         │ Telegram MA  │
                 └──────┬───────┘         └──────┬───────┘
                        │  GET (public)          │  GET + write (x-telegram-init-data)
                        ▼                        ▼
                     ┌───────────────────────────────┐
                     │        server (3001)          │
                     │   NestJS REST API + bot       │
                     └───────────────┬───────────────┘
                                     │ Prisma
                                     ▼
                          ┌────────────────────┐
                          │  PostgreSQL (5433) │
                          └────────────────────┘
```

- **Ingress:** in production a Caddy container (compose profile `prod`) is the
  only thing published to the internet (ports 80/443, automatic HTTPS). It
  routes `/admin*` to the admin container (served under the Next.js basePath
  `/admin`) and everything else to the public site. Postgres, the API and both
  Next.js servers listen on `127.0.0.1` only.
- **Reads are public**, so the website can render content without auth.
- **Writes are admin-only**: the admin panel runs as a Telegram Mini App and
  sends the signed `initData` in the `x-telegram-init-data` header. The API
  verifies the signature **and** that the user is a member of the admin Telegram
  group (`ADMIN_GROUP_CHAT_ID`) — so only people in that group can change content.
  `GET /auth/me` tells the frontend who the caller is and whether they are an admin.

---

## Quick Start (Docker)

Create a root `.env` with at least the database password (see
[`.env.example`](.env.example)). If you already have a local `fice_pg_data`
volume from before this variable existed, its password is `postgres`:

```bash
echo POSTGRES_PASSWORD=postgres > .env
```

Then bring up the **entire stack** (database, API with migrations, both
frontends) with one command:

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Public web | http://localhost:3002 |
| Admin panel | http://localhost:3000/admin |
| API | http://localhost:3001 |
| API docs (Scalar) | http://localhost:3001/api/docs |
| PostgreSQL | localhost:5433 |

All ports are bound to `127.0.0.1`. Database migrations are applied before the
new API starts (see [Migrations on deploy](#migrations-on-deploy)), so the schema
is always in sync. The
Telegram bots are optional locally: without their tokens they are skipped. Use
separate dev bots; never run a laptop stack with the production tokens.

> **Testing writes locally?** Admin endpoints require Telegram auth by default.
> To open them up for development, start with `AUTH_DISABLED=true`:
> ```bash
> AUTH_DISABLED=true docker compose up --build
> ```

Stop everything (data is kept in a named volume):

```bash
docker compose down
```

---

## Local Development

You can run only the database in Docker and everything else on your host.

Start just PostgreSQL:

```bash
docker compose up -d postgres
```

### Server

```bash
cd server
cp .env.example .env      # then edit if needed
npm install
npx prisma migrate dev    # apply migrations + generate the client
npm run start:dev         # watch mode on http://localhost:3001
```

Interactive API reference: http://localhost:3001/api/docs

### Public web client

```bash
cd client/web
npm install
npm run dev               # http://localhost:3000
```

### Admin Telegram Mini App

The admin panel must be served over HTTPS for Telegram, so use an **ngrok**
tunnel in development.

```bash
cd client/admin
npm install
ngrok http 3000           # in a separate terminal; copy the https URL
npm run dev               # http://localhost:3000/admin
```

The admin is served under the basePath `/admin`, so point the bot at
`https://<tunnel-host>/admin` via `MINI_APP_URL` (in `server/.env`, or the root
`.env` when the server runs in Docker) and add the tunnel host to `NGROK_HOST`
(read by `client/admin/next.config.ts` as `allowedDevOrigins`). Send `/start`
to your bot — it replies with a button that opens the admin panel.

---

## Environment Variables

With Docker, every variable comes from the root `.env`; the full annotated list
is in [`.env.example`](.env.example). When the API runs on the host it reads
`server/.env` instead (see [`server/.env.example`](server/.env.example)).

"Prod" means the server refuses to start without the variable when
`APP_ENV=production`.

| Variable | Required | Production value / description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | always | Superuser password; compose builds `DATABASE_URL` from it. Applied only when the volume is first created |
| `APP_ENV` | prod | `production`: startup checks, no `AUTH_DISABLED`, no `/api/docs`, seed blocked |
| `COMPOSE_PROFILES` | prod | `prod` (adds the Caddy ingress) |
| `TELEGRAM_BOT_TOKEN` | prod | Admin bot token from [@BotFather](https://t.me/BotFather) |
| `USER_BOT_TOKEN` | prod | Student bot token; must differ from `TELEGRAM_BOT_TOKEN` |
| `USER_BOT_USERNAME` | prod | Student bot username without `@`; also baked into the web image |
| `ADMIN_GROUP_CHAT_ID` | prod | Numeric id of the admin group; the admin bot must be a member |
| `MINI_APP_URL` | prod | `https://fice-sc.kpi.ua/admin` |
| `USER_MINI_APP_URL` | prod | `https://fice-sc.kpi.ua/app` |
| `PUBLIC_WEB_URL` | prod | `https://fice-sc.kpi.ua` |
| `CORS_ORIGIN` | prod | `https://fice-sc.kpi.ua` |
| `USER_MINI_APP_NAME` | no (`app`) | Short name of the student Mini App in @BotFather |
| `TELEGRAM_CHANNEL_ID` | no | Channel for announcements (bot must be admin) |
| `PARTNERSHIP_CHAT_ID` | no | Chat for partner applications (`chatId/threadId` for a topic) |
| `PARTNERSHIP_HEAD_TG`, `COUNCIL_HEAD_TG` | no | Usernames pinged on partner applications |
| `AUTH_DISABLED` | no (`false`) | `true` bypasses admin auth — **dev only**, refused in production |
| `DATABASE_URL`, `PORT`, `UPLOAD_DIR` | host only | Set by compose in Docker; needed in `server/.env` on the host |
| `ALLOW_DESTRUCTIVE_SEED` | no | `1` lets `npm run db:seed` wipe a dev database |

## Production Deploy

On the VM, fill the root `.env` with the production values above
(`APP_ENV=production`, `COMPOSE_PROFILES=prod`, a strong `POSTGRES_PASSWORD`
set before the very first `up`). Point the `fice-sc.kpi.ua` A record at the VM.
Build images one at a time, then start the stack:

```bash
docker compose build server
docker compose build web
docker compose build admin
docker compose up -d
docker compose exec server npm run db:seed:departments
```

`db:seed:departments` makes sure every department page of the website
(`projects`, `media`, `partnerships`, `merch`, `education`, `applicants`) has a
department linked to it by slug. It links a department that still has the
page's default name, creates only the missing ones and never renames or deletes
anything, so running it again is safe. It does not create «Президія»: the
presidium is managed in the admin's «Президія» tab. `GET /health` on the API
reports the polling state of both bots and returns 503 while one is restarting.

### Migrations on deploy

Later deploys stay `git pull && docker compose up -d --build`. Migrations run in
two places:

1. **While the server image is built.** If Postgres is reachable on
   `127.0.0.1:5433`, the build applies pending migrations
   (`server/scripts/migrate-gate.sh`, password passed as a build secret, never
   stored in the image). If a migration fails, the build fails, compose stops
   before touching any container, and the running API and bots keep serving the
   old version. Fix the migration, mark the failed one with
   `docker compose run --rm migrate npx prisma migrate resolve --rolled-back <name>`
   if Prisma asks for it, and deploy again.
2. **In the one-shot `migrate` service**, which `server` waits for. This covers
   the first start, when the database is not running yet during the build.

Take a database backup before deploying a change that contains migrations.

### Images

Uploaded JPEG and PNG images are resized (1920 px for admin uploads, 3200 px
for receipts and costume photos) and stripped of EXIF data on upload, one image
at a time. This uses sharp when the CPU supports it. On a CPU without
x86-64-v2 sharp cannot load: the server logs one warning and falls back to a
slower pure-JavaScript encoder. The fallback stores images over 25 megapixels,
and WebP files, as they are. Anything over 50 megapixels is rejected in both
modes. The web app's `/_next/image` also needs sharp; without it, it serves the
original file, so static images in `client/web/public` are kept small.

To shrink uploads that were stored before this processing existed, back up the
uploads volume and run:

```bash
docker compose exec server npm run uploads:reencode
```

It re-encodes oversized JPEG and PNG files in place, keeping their names and
URLs, and keeps the original when the new file would not be smaller. Add
`-- --dry-run` to only list the files it would change.

---

## API Overview

All resources live at the API root and follow standard REST conventions. `GET`
is public; `POST`/`PATCH`/`PUT`/`DELETE` require admin auth unless noted.

| Resource | Base path | Notes |
|----------|-----------|-------|
| Health | `GET /health` | Liveness check plus bot polling state; 503 while a bot is restarting |
| Auth | `GET /auth/me` | Current Telegram user + `isAdmin` flag |
| Facts & results | `/facts` | Computed activity stats + admin overrides |
| News | `/news` | |
| Events | `/event` | Includes details & partners; partner links via `/event/:id/partners` |
| Event details | `/event-details` | Money raised, charity, visitors |
| Fundraisers | `/fundraiser` | Filter by `?status=ACTIVE\|CLOSED` |
| Partners | `/partner` | Public application via `POST /partner/apply`; approve via `PATCH /partner/:id/approve` |
| Departments | `/department` | Links head, details, members |
| Department heads | `/department-head` | |
| Department details | `/department-details` | |
| Department members | `/department-member` | Assign via `/department-member/:id/assignments` |
| Join applications | `/applicant` | Public submit via `POST /applicant`; listing is admin-only |
| Admin users | `/user` | Admin-only |
| Uploads | `POST /upload` | Upload an image (admin) → returns `{ url }`; files served at `/uploads/...` |

The **facts & results** section is computed from the database (events held,
money raised, charity amount, visitors reached, partners, departments, members)
and an admin can pin any value via `PUT /facts/overrides/:key`.

List endpoints (news, events, fundraisers, partners, applications) are paginated
with `?page` and `?limit`, returning `{ items, total, page, limit, totalPages }`.
Public form submissions (`/applicant`, `/partner/apply`) are rate-limited.

Full, interactive documentation — rendered with **Scalar** — is served at
**`/api/docs`** (not in production).

---

## Database & Prisma

The schema lives in [`server/prisma/schema.prisma`](server/prisma/schema.prisma)
and uses the `@prisma/adapter-pg` driver adapter. All commands run from `server/`:

| Command | Description |
|---------|-------------|
| `npx prisma migrate dev --name <name>` | Create & apply a migration (development) |
| `npx prisma migrate deploy` | Apply pending migrations (production / CI) |
| `npx prisma generate` | Regenerate the TypeScript client |
| `npx prisma studio` | Open the database GUI |
| `ALLOW_DESTRUCTIVE_SEED=1 npm run db:seed` | **Wipe** the database and fill it with sample data (dev only; refused when `APP_ENV=production`) |
| `npm run db:seed:departments` | Link or create the departments of the website pages; safe on production |
| `npm run uploads:reencode` | Shrink oversized uploaded images in place (add `-- --dry-run` to only list them) |

Typical workflow: edit `schema.prisma` → `migrate dev` → use the generated client
through `PrismaService` in your NestJS services.

---

## Project Structure

```
fice-web
├── client/
│   ├── web/                  # Public Next.js site
│   └── admin/                # Admin Telegram Mini App (Next.js)
├── server/                   # NestJS API + Telegram bot
│   ├── prisma/               # Schema & migrations
│   └── src/
│       ├── auth/             # Telegram admin guard + @Admin() decorator
│       ├── bot/              # grammY Telegram bot
│       ├── common/           # Prisma exception filter
│       ├── database/         # Global PrismaModule / PrismaService
│       └── modules/          # Feature modules (event, fundraiser, department, ...)
├── Caddyfile                 # TLS ingress config (compose profile `prod`)
├── .env.example              # Every compose variable, with production values
└── docker-compose.yml        # Full stack: postgres + server + admin + web (+ caddy)
```

---

## Links

- [Design (Figma)](https://www.figma.com/design/6PNDP1PeSVTXkwWkBtbtdw/)
- [NestJS](https://docs.nestjs.com) · [Next.js](https://nextjs.org/docs) · [Prisma](https://www.prisma.io/docs)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
