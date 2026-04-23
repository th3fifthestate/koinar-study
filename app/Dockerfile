# ============================================
# Stage 1: Install dependencies (all — used by builder)
# ============================================
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

# ============================================
# Stage 1b: Install prod-only dependencies (used by runner for scripts)
# ============================================
# Next.js standalone output strips most packages from node_modules by
# inlining them into server.js via webpack. Seed/admin scripts run
# outside that bundle and can't resolve inlined packages at runtime, so
# the runner stage needs a real node_modules with every prod dep
# present (zod, dotenv, better-sqlite3, argon2, resend, @anthropic-ai/sdk,
# …). We install `--omit=dev` here so dev-only tooling (playwright,
# vitest, jsdom, etc.) doesn't bloat the final image.
FROM node:22-alpine AS prod-deps
WORKDIR /app

RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ============================================
# Stage 2: Build the application
# ============================================
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build-time env vars (NEXT_PUBLIC_* are baked into the client bundle)
ARG NEXT_PUBLIC_APP_URL=https://koinar.app
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Provide placeholder secrets so Next.js doesn't fail env validation at build time
# These are only used during the build — runtime values come from Railway env vars
ENV RESEND_API_KEY=placeholder
ENV SESSION_SECRET=placeholder-build-only-not-used-at-runtime-must-be-64-chars-long!!
ENV ANTHROPIC_API_KEY=placeholder

RUN npm run build

# ============================================
# Stage 3: Production runner
# ============================================
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat su-exec

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone Next.js output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Source files needed for one-off seed/admin scripts run via `railway ssh --
# npx tsx scripts/<name>.ts`. The standalone Next.js output does not
# include these because they are not part of the server bundle. They MUST
# live at paths that do NOT collide with the persistent-volume mount
# (now mounted at /app/db, not /app/data) — the scripts read seed JSON
# from /app/data/seeds/ and TSV from /app/data/tipnr/.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Next.js standalone ships ~40MB of node_modules with most deps inlined
# into server.js by webpack. Seed scripts run outside that bundle and
# need the prod deps resolvable at runtime. Overlay from the prod-deps
# stage (not the builder's full tree) so we get zod/dotenv/argon2/etc.
# without bloating the image with devDeps (playwright, vitest, …).
# Docker COPY merges file-by-file: standalone-only entries are
# preserved; colliding files overwrite with identical versions (both
# came from the same package-lock).
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# tsx is a devDependency, so it is absent from the standalone node_modules.
# Install it globally so seed scripts can be invoked as `npx tsx ...`.
RUN npm install -g tsx@4

# Entrypoint starts as root so it can chown the persistent-volume mount,
# then drops to `nextjs` via su-exec before launching the server.
COPY --chown=root:root docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
