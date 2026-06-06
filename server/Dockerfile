FROM node:20-alpine

WORKDIR /app

# Install dependencies from the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source, generate the Prisma client and build the app.
COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3001

# Apply any pending migrations, then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
