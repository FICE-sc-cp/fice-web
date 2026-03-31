FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
# Prisma needs python and build tools for some architectures occasionally, but mostly we are fine on alpine. Let's just run npm install.
RUN npm install

# Copy source
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build NestJS
RUN npm run build

EXPOSE 3001

# Start the server
CMD ["npm", "run", "start:prod"]
