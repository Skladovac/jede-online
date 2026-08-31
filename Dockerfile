# syntax=docker/dockerfile:1
# jede.online landing — produkční image pro vlastní server (Hetzner CX23).
# Build běží NA SERVERU. Bez swapu (viz bootstrap-server.sh) `next build`
# na 4 GB RAM spadne.

FROM node:20-bookworm-slim AS base
# Prisma potřebuje openssl; bez něj engine na startu spadne na "libssl not found".
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── deps ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ── builder ───────────────────────────────────────────────────────────
# Slouží zároveň jako "migrator" — má prisma CLI i prisma/migrations/,
# takže z něj jede migrační brána (pojistka 3).
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG GIT_COMMIT=unknown
ENV NEXT_PUBLIC_GIT_COMMIT=${GIT_COMMIT}
# build:docker = prisma generate && next build.
# ZÁMĚRNĚ bez `migrate deploy` — build nemá sahat do databáze.
RUN npm run build:docker

# ── runner ────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma engine standalone trace občas nezachytí. Bez tohohle padá runtime
# na "Query engine library not found" až po nasazení, ne při buildu.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma/client ./node_modules/.prisma/client

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=${GIT_COMMIT}
CMD ["node", "server.js"]
