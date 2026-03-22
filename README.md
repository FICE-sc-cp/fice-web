# FICE Web

Web application for the student council built with **Next.js** and **NestJS**.

| Category | Technology |
|----------|-----------|
| **Frontend (Web)** | Next.js |
| **Frontend (Admin)** | Next.js + Telegram Mini App SDK |
| **Backend** | NestJS |
| **Database** | PostgreSQL (via Docker) |
| **ORM** | Prisma |
| **Language** | TypeScript |

---

## Table of Contents

- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Quick Start](#quick-start)
- [Development](#development)
  - [Client — Web](#client--web)
  - [Client — Admin Telegram Mini App](#client--admin-telegram-mini-app)
  - [Server](#server)
- [Database](#database)
  - [Docker (PostgreSQL)](#docker-postgresql)
  - [Environment Configuration](#environment-configuration)
  - [Prisma ORM](#prisma-orm)
- [Links](#links)

---

## Project Structure

```
fice-web
│
├── client/
│   ├── web/      # Public-facing Next.js frontend
│   └── admin/    # Admin Telegram Mini App (Next.js)
└── server/       # NestJS backend (API + Telegram bot)
```

---

## Getting Started

### Prerequisites

- **Node.js** (v18+) and **npm**
- **Docker** — for the PostgreSQL database
- **ngrok** — only needed for admin mini app development ([ngrok.com](https://ngrok.com/))
- **Telegram bot token** — only needed for admin mini app (from [@BotFather](https://t.me/BotFather))

### Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd fice-web

# 2. Start the database
cd server
docker compose up -d

# 3. Configure environment
#    Create server/.env (see "Environment Configuration" below)

# 4. Install dependencies & run migrations
npm install
npx prisma migrate dev
npx prisma generate

# 5. Start the backend
npm run start:dev

# 6. In a new terminal — start the web client
cd client/web
npm install
npm run dev
```

The web client opens at [http://localhost:3000](http://localhost:3000).

---

## Development

### Client — Web

```bash
cd client/web
npm install
```

**Dev server:**

```bash
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

**Production build:**

```bash
npm run build
npm run start
```

### Client — Admin Telegram Mini App

The admin panel runs as a **Telegram Mini App** inside a bot. Telegram requires a public HTTPS URL, so you need an **ngrok** tunnel for local development.

#### 1. Install dependencies

```bash
cd client/admin
npm install
```

#### 2. Start an ngrok tunnel

In a separate terminal, expose the dev server port:

```bash
ngrok http 3000
```

Copy the generated `https://` URL (e.g. `https://xxxx-xxxx.ngrok-free.app`).

#### 3. Configure the ngrok URL

**`client/admin/next.config.ts`** — set your ngrok hostname:

```typescript
const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'your-subdomain.ngrok-free.app',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'your-subdomain.ngrok-free.app',
      },
    ],
  },
};
```

**`server/.env`** — set the mini app URL:

```env
MINI_APP_URL="https://your-subdomain.ngrok-free.app/"
```

#### 4. Start the dev server

```bash
npm run dev
```

#### 5. Open the Mini App

Send any message to your bot in Telegram — it will reply with a button that opens the admin panel via the ngrok URL.

**Production build:**

```bash
npm run build
npm run start
```

### Server

```bash
cd server
npm install
```

**Dev server (watch mode):**

```bash
npm run start:dev
```

**Production build:**

```bash
npm run build
npm run start:prod
```

---

## Database

### Docker (PostgreSQL)

**Start** the container:

```bash
cd server
docker compose up -d
```

Port mapping: `5433:5432` (host:container).

**Stop** the container:

```bash
docker compose down
```

### Environment Configuration

Create a `.env` file in `server/`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/fice?schema=public"
TELEGRAM_BOT_TOKEN="<your-bot-token>"
MINI_APP_URL="<your-ngrok-url>"
```

### Prisma ORM

All Prisma commands run from the `server/` directory.

| Command | Description |
|---------|-------------|
| `npx prisma migrate dev --name <name>` | Create and apply a migration |
| `npx prisma generate` | Regenerate the TypeScript client |
| `npx prisma studio` | Open the database GUI |

**Typical workflow:**

1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <describe_change>` to create the migration
3. Run `npx prisma generate` to update the TypeScript client
4. Use the generated client in code:

```typescript
const post = await prisma.post.create({
  data: { title: "Hello", authorId: 1 },
});
```

---

## Links

- [Next.js Documentation](https://nextjs.org/docs)
- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
