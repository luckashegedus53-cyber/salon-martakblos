FROM node:22-alpine AS builder
WORKDIR /app

# Install exact pnpm version used in the project
RUN npm install -g pnpm@10.4.1

# Copy package files AND patches (required by pnpm)
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install all dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

# Build the client (Vite) and server
RUN pnpm build

# Production stage
FROM node:22-alpine AS production
WORKDIR /app

# Copy everything needed to run
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

EXPOSE 3000

ENV NODE_ENV=production

CMD ["sh", "-c", "npx drizzle-kit migrate --config=drizzle.config.ts && node dist/index.js"]
