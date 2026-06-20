FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Next bakes next.config rewrites() into the build, so the /api-proxy backend
# target must be present at build time (not just runtime). Defaults to the
# compose service name so it works on the docker network out of the box.
ARG BACKEND_URL=http://server:3001
ENV BACKEND_URL=$BACKEND_URL

# Build Next.js
RUN npm run build

# Expose port (default for Next.js is 3000)
EXPOSE 3000

# Start app
CMD ["npm", "run", "start"]
