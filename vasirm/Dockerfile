# syntax=docker/dockerfile:1
# vasirm.jede.online (později vasirm.cz) — produkční image pro vlastní server (Hetzner CX23).
# Build běží NA SERVERU. Vzor: pokemon/Dockerfile.

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
# Pozor: sharp má nativní knihovny jako optionalDependencies — žádné --omit=optional.
# Lokální vývojový Postgres (embedded-postgres, ~100 MB) v obrazu nepotřebujeme.
RUN npm ci && rm -rf node_modules/embedded-postgres node_modules/@embedded-postgres

# ── builder ───────────────────────────────────────────────────────────
# Slouží zároveň jako „tools“ (migrace, import, správa účtů) — má prisma CLI, tsx i scripts/.
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG GIT_COMMIT=unknown
ENV NEXT_PUBLIC_GIT_COMMIT=${GIT_COMMIT}
# ZÁMĚRNĚ bez `migrate deploy` — build nemá sahat do databáze.
RUN npm run build:docker

# ── runner ────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs \
 && mkdir -p /app/media && chown nextjs:nodejs /app/media

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma engine a sharp (nativní knihovny) standalone trace občas nezachytí — padá to až po nasazení.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma/client ./node_modules/.prisma/client
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0 MEDIA_DIR=/app/media
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=${GIT_COMMIT}
CMD ["node", "server.js"]
