FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

ARG BACKEND_URL=http://server:3001
ENV BACKEND_URL=$BACKEND_URL
ENV INTERNAL_API_URL=$BACKEND_URL

# Build Next.js
RUN npm run build

# Expose port (default for Next.js is 3000)
EXPOSE 3000

# Start app
CMD ["npm", "run", "start"]
