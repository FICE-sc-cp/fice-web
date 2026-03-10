# FICE Web

Web application for the student council built with **Next.js (client)** and **NestJS (server)**.

---

## 📋 Table of Contents

- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Client (Next.js)](#client-nextjs)
- [Server (NestJS)](#server-nestjs)
- [Database Setup](#database-setup)
- [Prisma ORM](#prisma-orm)
- [Tech Stack](#tech-stack)
- [Documentation](#documentation)

---

## 📁 Project Structure

```
fice-web
│
├── client/    # Next.js frontend
└── server/    # NestJS backend
```

---

## 🚀 Getting Started

1. Clone the repository
2. Install dependencies for both client and server (see sections below)
3. Set up the database (see [Database Setup](#database-setup))
4. Run the development servers

---

## 💻 Client (Next.js)

### Installation

```bash
cd client
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm run start
```

---

## 🔧 Server (NestJS)

### Installation

```bash
cd server
npm install
```

### Development

Run the development server in watch mode:

```bash
npm run start:dev
```

### Production Build

```bash
npm run build
npm run start:prod
```

---

## 🗄️ Database Setup

### Using Docker (PostgreSQL)

#### Start PostgreSQL Container

```bash
cd server
docker compose up -d
```

This will start a PostgreSQL container.

**Port mapping:** `5433:5432` (host:container)

#### Stop Containers

```bash
docker compose down
```

### Environment Configuration

Create a `.env` file in the `server/` directory:

```local env example
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/fice?schema=public"
```

---

## 🗃️ Prisma ORM

### Prisma Commands

#### Run Migrations

Update the database schema:

```bash
cd server
npx prisma migrate dev --name init
```

#### Generate Prisma Client

Update the TypeScript client:

```bash
npx prisma generate
```

#### View Database (Prisma Studio)

Open Prisma Studio in your browser:

```bash
npx prisma studio
```

### Workflow Guide

1. Change `schema.prisma` → Run `migrate dev` to update the database
2. Run `generate` → Update Prisma Client for TypeScript

### Example Workflow

**1. Add a new model in `schema.prisma`:**

```prisma
model Post {
  id       Int    @id @default(autoincrement())
  title    String
  content  String?
  authorId Int
  author   User   @relation(fields: [authorId], references: [id])
}
```

**2. Run migrate** → Creates `Post` table in the database:

```bash
npx prisma migrate dev --name add_post_model
```

**3. Run generate** → Updates Prisma Client for TypeScript:

```bash
npx prisma generate
```

**4. Use in code:**

```typescript
const newPost = await prisma.post.create({
  data: { 
    title: "Hello", 
    authorId: 1 
  }
})
```

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | Next.js |
| **Backend** | NestJS |
| **Database** | PostgreSQL (via Docker) |
| **ORM** | Prisma |
| **Language** | TypeScript |

---

## 📚 Documentation

- **Next.js:** [https://nextjs.org/docs](https://nextjs.org/docs)
- **NestJS:** [https://docs.nestjs.com](https://docs.nestjs.com)
- **Prisma:** [https://www.prisma.io/docs](https://www.prisma.io/docs)

---
