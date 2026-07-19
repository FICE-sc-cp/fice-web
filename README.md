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

- **Reads are public**, so the website can render content without auth.
- **Writes are admin-only**: the admin panel runs as a Telegram Mini App and
  sends the signed `initData` in the `x-telegram-init-data` header. The API
  verifies the signature **and** that the user is a member of the admin Telegram
  group (`ADMIN_GROUP_CHAT_ID`) — so only people in that group can change content.
  `GET /auth/me` tells the frontend who the caller is and whether they are an admin.

---

## Quick Start (Docker)

Bring up the **entire stack** (database, API with migrations, both frontends)
with one command:

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Public web | http://localhost:3002 |
| Admin panel | http://localhost:3000 |
| API | http://localhost:3001 |
| API docs (Scalar) | http://localhost:3001/api/docs |
| PostgreSQL | localhost:5433 |

The `server` container automatically runs `prisma migrate deploy` on startup, so
the schema is always in sync. The Telegram bot is optional — without
`TELEGRAM_BOT_TOKEN` it is simply skipped.

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
npm run dev
```

Then point the bot at the tunnel via `MINI_APP_URL` in `server/.env` and add the
ngrok host to `client/admin/next.config.ts` (`allowedDevOrigins`). Send any
message to your bot — it replies with a button that opens the admin panel.

---

## Environment Variables

Configured in `server/.env` (see [`server/.env.example`](server/.env.example)):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `PORT` | no (3001) | API port |
| `TELEGRAM_BOT_TOKEN` | no | Bot token from [@BotFather](https://t.me/BotFather). Required for the bot and for admin auth |
| `MINI_APP_URL` | no | Public HTTPS URL of the admin Mini App |
| `ADMIN_GROUP_CHAT_ID` | no | Telegram group whose members are admins. Add the bot to the group; if empty, any authenticated Telegram user is allowed |
| `AUTH_DISABLED` | no (false) | `true` bypasses admin auth on write endpoints — **dev only** |
| `UPLOAD_DIR` | no (./uploads) | Where uploaded images are stored (persisted via a Docker volume) |

---

## API Overview

All resources live at the API root and follow standard REST conventions. `GET`
is public; `POST`/`PATCH`/`PUT`/`DELETE` require admin auth unless noted.

| Resource | Base path | Notes |
|----------|-----------|-------|
| Health | `GET /health` | Liveness check |
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
**`/api/docs`**.

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
| `npm run db:seed` | Populate the database with sample data |

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
└── docker-compose.yml        # Full stack: postgres + server + admin + web
```

---

## Links

- [Design (Figma)](https://www.figma.com/design/6PNDP1PeSVTXkwWkBtbtdw/)
- [NestJS](https://docs.nestjs.com) · [Next.js](https://nextjs.org/docs) · [Prisma](https://www.prisma.io/docs)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
