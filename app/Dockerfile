# ============================================
# Stage 1: Install dependencies
# ============================================
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

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

# Provide a placeholder key so Next.js doesn't fail env validation at build time
ENV RESEND_API_KEY=placeholder

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
