# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS builder
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
RUN npm ci && npm --prefix apps/api ci

COPY prisma ./prisma
RUN npm run generate:prisma

COPY tsconfig.json ./
COPY apps ./apps
COPY docs ./docs
COPY scripts ./scripts
RUN npm --prefix apps/api run build && npm run build:bot

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations
RUN npm ci --omit=dev && npm --prefix apps/api ci --omit=dev && npm cache clean --force

COPY --from=builder /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/backend/apps/api/dist ./apps/api/dist
COPY --from=builder /app/backend/apps/telegram-bot/dist ./apps/telegram-bot/dist
COPY docs ./docs
COPY scripts/container-init.cjs scripts/apply-migrations.cjs ./scripts/

USER node
CMD ["node", "apps/api/dist/src/server.js"]
