FROM node:22-alpine

WORKDIR /app

# Install dependencies from the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source, generate the Prisma client and build the app.
COPY . .
RUN npx prisma generate
RUN npm run build

RUN --mount=type=secret,id=postgres_password,required=false \
    sh scripts/migrate-gate.sh

EXPOSE 3001

CMD ["node", "dist/main"]
