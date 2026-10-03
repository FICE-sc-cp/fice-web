FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

ARG BACKEND_URL=http://server:3001
ENV BACKEND_URL=$BACKEND_URL
ENV INTERNAL_API_URL=$BACKEND_URL
ARG NEXT_PUBLIC_USER_BOT_USERNAME=
ENV NEXT_PUBLIC_USER_BOT_USERNAME=$NEXT_PUBLIC_USER_BOT_USERNAME

# Build Next.js
RUN npm run build

# Expose port (default for Next.js is 3000)
EXPOSE 3000

# Start app
CMD ["node", "node_modules/next/dist/bin/next", "start"]
