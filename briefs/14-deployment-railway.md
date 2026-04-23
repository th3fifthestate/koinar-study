# Brief 14: Railway Deployment & Infrastructure Setup

**Recommended mode: Direct Execution**

> **Branch:** All work on `develop`. When ready for launch: merge `develop` → `main` to deploy to production.
> **Path note:** This project uses `app/` not `app/src/`.

---

## 🚦 V1 Pre-Launch Cleanup Checklist (2026-04-15)

Run these **before** promoting `develop` to `main` for the V1 launch. These represent intentional deferrals that were built but should not ship in V1 (see `founders-files/implementation-plan.md → Post-V1 Roadmap`).

### Hide public/community annotation UI (deferred to V2 Study Rooms)

The public annotation feature set was built in Brief 08b but is deferred to V2. Schema and WebSocket infrastructure stay — only the user-facing UI is removed for V1.

- [ ] Remove or hide the **community toggle** in `app/components/reader/study-header.tsx` (props: `showCommunityAnnotations`, `onCommunityToggle`, `communityAnnotationCount`)
- [ ] Remove or hide the **community annotation count badge** from the study header
- [ ] Remove or hide the **"Share publicly"** toggle/checkbox in `app/components/reader/annotation-popover.tsx` — all V1 annotations default to private (`is_public=0`)
- [ ] Remove or hide the **active readers** presence indicator in `app/components/reader/study-header.tsx` (V2 will scope presence to study rooms)
- [ ] Remove `showCommunity` prop paths in `app/lib/hooks/use-study-annotations.ts` or force it to `false` — don't fetch public annotations from other users
- [ ] Update `app/app/api/studies/[id]/annotations/route.ts` GET handler to return only `user_id = current_user` annotations (drop the public-of-others union) for V1
- [ ] Verify annotation CRUD still works end-to-end with private-only UI
- [ ] Leave `is_public` column, WebSocket broadcaster, and `community-toggle.tsx` component in the codebase — V2 Study Rooms will restore and reconfigure them

**Acceptance:** A logged-in user can highlight/note, see their own annotations, and cannot see or create public annotations. No "community" language or UI elements visible.

---

## Context

You are preparing the Bible study community app for deployment on Railway ($5/month persistent server). The app uses SQLite for both the application database and read-only Bible databases, which makes Railway's persistent volume support ideal. Images are stored on Cloudflare R2 (free tier, S3-compatible).

Before starting, read these files for full context:
- `/Users/davidgeorge/Desktop/study-app/founders-files/DESIGN-DECISIONS.md` -- all confirmed architecture decisions
- Brief 01 at `/Users/davidgeorge/Desktop/study-app/briefs/01-project-scaffolding.md` -- the existing Dockerfile and project structure

The project lives at `/Users/davidgeorge/Desktop/study-app/app/`. All file paths below are relative to that root unless specified as absolute.

---

## 1. Updated Dockerfile

Replace the existing Dockerfile at `/Users/davidgeorge/Desktop/study-app/app/Dockerfile` with this improved version that handles the custom server, Bible databases, and persistent volume:

```dockerfile
# ============================================
# Stage 1: Install dependencies
# ============================================
FROM node:22-alpine AS deps
WORKDIR /app

# Install build tools needed for native modules (better-sqlite3, argon2, sharp)
RUN apk add --no-cache python3 make g++ libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

# ============================================
# Stage 2: Build the application
# ============================================
FROM node:22-alpine AS builder
WORKDIR /app

# Need build tools for native module rebuilding during build
RUN apk add --no-cache python3 make g++ libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js with standalone output
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ============================================
# Stage 3: Production runner
# ============================================
FROM node:22-alpine AS runner
WORKDIR /app

# Runtime dependencies for native modules
RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone Next.js output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Bible databases into the image (read-only, ~100MB total)
# These are bundled because they never change and should not be on the volume
COPY --from=builder /app/data/databases ./data/databases

# Copy the custom server (for WebSocket support)
COPY --from=builder /app/server.ts ./server.ts

# Create the directory for the persistent volume mount
# The app database (app.db) will live here, persisted across deploys
RUN mkdir -p /data && chown nextjs:nodejs /data

# Copy package.json for the start script
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Database paths
# Bible databases: bundled in image (read-only)
ENV BIBLE_DB_PATH=/app/data/databases
# App database: on persistent volume (read-write, survives redeploys)
ENV DATABASE_PATH=/data/app.db

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the custom server (handles both HTTP and WebSockets)
CMD ["node", "src/server.js"]
```

**Key design decisions in this Dockerfile:**
- Bible databases (~100MB) are BUNDLED in the Docker image because they are read-only and never change. This avoids putting them on the volume where they would need to survive redeploys.
- The app database (app.db) lives on a PERSISTENT VOLUME at `/data/app.db` so user data survives across deploys.
- The custom server (`src/server.ts`, compiled to `src/server.js`) handles both Next.js HTTP requests and WebSocket connections.

---

## 2. Custom Server for WebSockets

Create `/src/server.ts`:

Railway supports long-lived connections, so we can run WebSockets alongside Next.js using a custom server.

```ts
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // WebSocket server for real-time annotations
  const wss = new WebSocketServer({ noServer: true });

  // Track connections by study ID
  const studyRooms = new Map<string, Set<WebSocket>>();

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const studyId = url.searchParams.get("studyId");

    if (!studyId) {
      ws.close(4000, "Missing studyId parameter");
      return;
    }

    // Join the study room
    if (!studyRooms.has(studyId)) {
      studyRooms.set(studyId, new Set());
    }
    studyRooms.get(studyId)!.add(ws);

    console.log(
      `WebSocket connected to study ${studyId}. Room size: ${studyRooms.get(studyId)!.size}`
    );

    ws.on("message", (data) => {
      // Broadcast to all other clients in the same study room
      const room = studyRooms.get(studyId);
      if (!room) return;

      const message = data.toString();
      for (const client of room) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    });

    ws.on("close", () => {
      const room = studyRooms.get(studyId);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          studyRooms.delete(studyId);
        }
      }
    });

    ws.on("error", (err) => {
      console.error(`WebSocket error for study ${studyId}:`, err.message);
    });
  });

  // Handle upgrade requests for WebSocket
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url!, true);

    if (pathname === "/ws/annotations") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Server ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server ready on ws://${hostname}:${port}/ws/annotations`);
    console.log(`> Environment: ${dev ? "development" : "production"}`);
  });
});
```

**Update `package.json` scripts:**

```json
{
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "next build",
    "start": "node src/server.js",
    "lint": "next lint"
  }
}
```

**Note:** For the custom server to work in production, you need to compile `src/server.ts` to JavaScript. The Next.js standalone build does NOT compile custom server files. Add a build step:

```json
{
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "next build && npx tsc src/server.ts --outDir . --esModuleInterop --module commonjs --target es2022 --skipLibCheck",
    "start": "node src/server.js",
    "lint": "next lint"
  }
}
```

Alternatively, install `tsx` as a production dependency and use it in the CMD:
```bash
npm install tsx
```
Then the Dockerfile CMD becomes: `CMD ["npx", "tsx", "src/server.ts"]`

Choose whichever approach is simpler. The `tsx` approach avoids a separate compile step but adds a dependency.

---

## 3. Health Check Endpoint

Create `/src/app/api/health/route.ts`:

```ts
import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import { config } from "@/lib/config";
import path from "path";
import fs from "fs";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  databases: {
    app: boolean;
    bsb: boolean;
    strongs: boolean;
    hebrew_greek: boolean;
    cross_refs: boolean;
  };
  errors: string[];
}

function checkDatabase(dbPath: string): boolean {
  try {
    if (!fs.existsSync(dbPath)) return false;
    const db = new Database(dbPath, { readonly: true });
    db.pragma("integrity_check");
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const errors: string[] = [];
  const startTime = process.hrtime.bigint();

  // Check app database (writable)
  let appDbOk = false;
  try {
    const appDbPath = config.db.app;
    if (fs.existsSync(appDbPath)) {
      const db = new Database(appDbPath);
      // Try a simple write operation to verify the volume is writable
      db.pragma("integrity_check");
      db.close();
      appDbOk = true;
    } else {
      // App DB might not exist yet on first deploy -- that is OK
      // The migration system should create it
      appDbOk = true;
      errors.push("App database does not exist yet (will be created on first run)");
    }
  } catch (err) {
    errors.push(`App database error: ${err instanceof Error ? err.message : "unknown"}`);
  }

  // Check Bible databases (read-only, bundled in image)
  const bsbOk = checkDatabase(config.db.bsb);
  const strongsOk = checkDatabase(config.db.strongs);
  const hebrewGreekOk = checkDatabase(config.db.hebrewGreek);
  const crossRefsOk = checkDatabase(config.db.crossRefs);

  if (!bsbOk) errors.push("BSB database not found or corrupt");
  if (!strongsOk) errors.push("Strong's database not found or corrupt");
  if (!hebrewGreekOk) errors.push("Hebrew/Greek database not found or corrupt");
  if (!crossRefsOk) errors.push("Cross-references database not found or corrupt");

  const allBibleDbsOk = bsbOk && strongsOk && hebrewGreekOk && crossRefsOk;

  // Determine overall status
  let status: "healthy" | "degraded" | "unhealthy";
  if (appDbOk && allBibleDbsOk) {
    status = "healthy";
  } else if (appDbOk) {
    status = "degraded"; // App works but some Bible DBs missing
  } else {
    status = "unhealthy";
  }

  const health: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    databases: {
      app: appDbOk,
      bsb: bsbOk,
      strongs: strongsOk,
      hebrew_greek: hebrewGreekOk,
      cross_refs: crossRefsOk,
    },
    errors,
  };

  const httpStatus = status === "unhealthy" ? 503 : 200;
  return NextResponse.json(health, { status: httpStatus });
}
```

---

## 4. Railway Configuration

Create `/Users/davidgeorge/Desktop/study-app/app/railway.toml`:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/api/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5
```

---

## 5. Environment Variables Reference

Create `/Users/davidgeorge/Desktop/study-app/app/RAILWAY-ENV-VARS.md` with the complete list of environment variables to configure in the Railway dashboard. **Do NOT include actual values -- this is a reference document.**

```markdown
# Railway Environment Variables

Set these in the Railway dashboard under your service's Variables tab.

## Required

| Variable | Description | Example |
|----------|-------------|---------|
| SESSION_SECRET | 32+ char hex string for encrypting session cookies | (generate with: openssl rand -hex 32) |
| ANTHROPIC_API_KEY | Admin's Anthropic API key for free-tier study generation | sk-ant-xxxxx |
| DATABASE_PATH | Path to app database on persistent volume | /data/app.db |
| BIBLE_DB_PATH | Path to bundled Bible databases | /app/data/databases |
| NEXT_PUBLIC_APP_URL | Public URL of the app | https://yourdomain.com |

## Image Generation (Optional)

| Variable | Description |
|----------|-------------|
| FLUX_API_KEY | Black Forest Labs Flux API key |
| R2_ACCOUNT_ID | Cloudflare account ID |
| R2_ACCESS_KEY_ID | R2 API token access key |
| R2_SECRET_ACCESS_KEY | R2 API token secret |
| R2_BUCKET_NAME | R2 bucket name (default: bible-study-images) |
| R2_PUBLIC_URL | Public URL for the R2 bucket |

## Translation APIs (Optional)

| Variable | Description |
|----------|-------------|
| ESV_API_KEY | ESV API token from api.esv.org |
| API_BIBLE_KEY | api.bible API key |

## Railway Auto-Set

These are automatically available in Railway:

| Variable | Description |
|----------|-------------|
| PORT | Port to listen on (Railway sets this) |
| RAILWAY_ENVIRONMENT | Current environment name |
```

---

## 6. Database Volume Strategy

This section explains the storage architecture. Implement it in the Dockerfile and configuration as specified above.

**Bible databases (bundled in Docker image):**
- BSB.db (~30MB)
- bible_hebrew_greek.db (~50MB)
- strongs.sqlite (~5MB)
- cross_references.db (~15MB)
- Total: ~100MB
- These are READ-ONLY and NEVER change
- Bundled into the Docker image via `COPY` at build time
- Path: `/app/data/databases/`
- Rationale: Bundling avoids needing to download them on each deploy or store them on the volume

**App database (persistent volume):**
- app.db (starts small, grows with users/studies)
- This is READ-WRITE and contains all user data
- Stored on Railway persistent volume
- Path: `/data/app.db`
- The volume must be configured in Railway dashboard:
  - Mount path: `/data`
  - Size: 1GB (expandable)
- Rationale: Persistent volume survives redeploys and container restarts

**Volume setup in Railway:**
1. Go to your service in the Railway dashboard
2. Click "Settings" tab
3. Under "Volumes", click "Add Volume"
4. Set mount path to `/data`
5. Set size to 1GB
6. Railway will create and mount the volume automatically

---

## 7. Backup Strategy

Create `/src/lib/backup/r2-backup.ts`:

A simple backup script that copies the app database to R2 for disaster recovery.

```ts
import { readFileSync } from "fs";
import { uploadImageToR2 } from "@/lib/images/r2";
import { config } from "@/lib/config";

/**
 * Backup the app database to R2.
 * Creates a timestamped copy in the backups/ prefix.
 */
export async function backupDatabaseToR2(): Promise<{
  key: string;
  sizeBytes: number;
  timestamp: string;
}> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const key = `backups/app-db-${timestamp}.db`;

  // Read the database file
  const dbBuffer = readFileSync(config.db.app);

  // Upload to R2
  await uploadImageToR2(dbBuffer, key, "application/x-sqlite3");

  return {
    key,
    sizeBytes: dbBuffer.length,
    timestamp: new Date().toISOString(),
  };
}
```

Create an admin API route to trigger backups:

Create `/src/app/api/admin/backup/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { backupDatabaseToR2 } from "@/lib/backup/r2-backup";

export async function POST() {
  const session = await getSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const result = await backupDatabaseToR2();
    return NextResponse.json({
      success: true,
      backup: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

---

## 8. Cloudflare R2 Setup Instructions

Create `/Users/davidgeorge/Desktop/study-app/app/R2-SETUP.md`:

```markdown
# Cloudflare R2 Setup Guide

## 1. Create R2 Bucket

1. Log in to the Cloudflare dashboard (https://dash.cloudflare.com)
2. Select your account
3. Go to R2 Object Storage in the sidebar
4. Click "Create bucket"
5. Name: `bible-study-images`
6. Location: Auto (or choose closest to Railway region)
7. Click "Create bucket"

## 2. Enable Public Access

1. Go to the bucket settings
2. Under "Public access", click "Allow Access"
3. Choose "Custom domain" or use the default R2.dev subdomain
4. If using R2.dev: go to Settings > Public Access > enable r2.dev subdomain
5. Note the public URL (e.g., https://pub-abc123.r2.dev)

## 3. Create API Token

1. Go to R2 Overview
2. Click "Manage R2 API Tokens"
3. Click "Create API token"
4. Permissions: Object Read & Write
5. Specify bucket: `bible-study-images`
6. TTL: No expiry (or set a long expiry)
7. Click "Create API Token"
8. Save the Access Key ID and Secret Access Key

## 4. Configure CORS

1. Go to the bucket settings
2. Under CORS policy, add:

```json
[
  {
    "AllowedOrigins": ["https://yourdomain.com", "http://localhost:3000"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

3. Replace `yourdomain.com` with your actual domain

## 5. Set Environment Variables

In Railway dashboard, set:
- R2_ACCOUNT_ID: Your Cloudflare account ID (found in the dashboard URL or Overview page)
- R2_ACCESS_KEY_ID: The Access Key ID from step 3
- R2_SECRET_ACCESS_KEY: The Secret Access Key from step 3
- R2_BUCKET_NAME: bible-study-images
- R2_PUBLIC_URL: The public URL from step 2

## Cost

R2 pricing (free tier):
- Storage: 10GB free/month
- Class A operations (writes): 1M free/month
- Class B operations (reads): 10M free/month
- Egress: Always free

For this app, you will stay well within the free tier.
```

---

## 9. Domain Setup Instructions

Add to the bottom of `R2-SETUP.md` or create a separate file `/Users/davidgeorge/Desktop/study-app/app/DOMAIN-SETUP.md`:

```markdown
# Custom Domain Setup

## Railway Custom Domain

1. Go to your Railway service
2. Click "Settings"
3. Under "Networking" > "Public Networking"
4. Click "Generate Domain" for a free *.up.railway.app subdomain
5. Or click "Custom Domain" and enter your domain

## If Using a Custom Domain

1. Add a CNAME record in your DNS provider:
   - Name: @ (or subdomain)
   - Value: (Railway provides this value)
   - TTL: Auto

2. Wait for DNS propagation (can take up to 48 hours, usually minutes)

3. Railway automatically provisions and renews SSL certificates via Let's Encrypt

4. Update NEXT_PUBLIC_APP_URL in Railway environment variables to your custom domain

5. Update the R2 CORS policy to include your custom domain
```

---

## 10. Deployment Checklist Script

Create `/scripts/deploy-checklist.ts`:

This is a pre-deployment validation script that checks everything is properly configured.

```ts
/**
 * Pre-deployment checklist for Railway.
 * Run with: npx tsx scripts/deploy-checklist.ts
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

interface Check {
  name: string;
  pass: boolean;
  message: string;
}

const checks: Check[] = [];

function check(name: string, condition: boolean, message: string) {
  checks.push({ name, pass: condition, message });
}

// 1. Dockerfile exists
check(
  "Dockerfile",
  fs.existsSync(path.join(ROOT, "Dockerfile")),
  "Dockerfile must exist in project root"
);

// 2. railway.toml exists
check(
  "railway.toml",
  fs.existsSync(path.join(ROOT, "railway.toml")),
  "railway.toml must exist for Railway configuration"
);

// 3. next.config.ts has standalone output
const nextConfig = fs.readFileSync(path.join(ROOT, "next.config.ts"), "utf-8");
check(
  "Standalone output",
  nextConfig.includes('"standalone"') || nextConfig.includes("'standalone'"),
  "next.config.ts must have output: 'standalone'"
);

// 4. Bible databases exist
const dbDir = path.join(ROOT, "data", "databases");
const requiredDbs = ["BSB.db", "bible_hebrew_greek.db", "strongs.sqlite", "cross_references.db"];
for (const db of requiredDbs) {
  check(
    `Bible DB: ${db}`,
    fs.existsSync(path.join(dbDir, db)),
    `${db} must exist in data/databases/`
  );
}

// 5. .env.example exists
check(
  ".env.example",
  fs.existsSync(path.join(ROOT, ".env.example")),
  ".env.example must exist with all required variables"
);

// 6. Health check route exists
check(
  "Health check",
  fs.existsSync(path.join(ROOT, "src", "app", "api", "health", "route.ts")),
  "Health check endpoint must exist at /api/health"
);

// 7. Custom server exists
check(
  "Custom server",
  fs.existsSync(path.join(ROOT, "src", "server.ts")),
  "Custom server must exist at src/server.ts"
);

// 8. No .env file in git (check .gitignore)
const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf-8");
check(
  ".env in .gitignore",
  gitignore.includes(".env"),
  ".env must be in .gitignore"
);

// 9. No database files in git
check(
  "*.db in .gitignore",
  gitignore.includes("*.db"),
  "*.db must be in .gitignore"
);

// Print results
console.log("\n=== Railway Deployment Checklist ===\n");

let allPassed = true;
for (const c of checks) {
  const icon = c.pass ? "[PASS]" : "[FAIL]";
  console.log(`${icon} ${c.name}`);
  if (!c.pass) {
    console.log(`       ${c.message}`);
    allPassed = false;
  }
}

console.log(`\n${allPassed ? "All checks passed." : "Some checks failed. Fix before deploying."}\n`);

if (!allPassed) {
  process.exit(1);
}
```

---

## Verification Steps

After completing all steps:

1. **Verify file structure exists:**
   - `/Dockerfile` -- updated multi-stage build
   - `/railway.toml` -- Railway configuration
   - `/src/server.ts` -- custom server with WebSocket support
   - `/src/app/api/health/route.ts` -- health check endpoint
   - `/src/lib/backup/r2-backup.ts` -- backup utility
   - `/src/app/api/admin/backup/route.ts` -- backup API route
   - `/scripts/deploy-checklist.ts` -- pre-deploy validation
   - `/RAILWAY-ENV-VARS.md` -- environment variable reference
   - `/R2-SETUP.md` -- Cloudflare R2 setup guide

2. **Run `npm run build`** and confirm the standalone output is generated in `.next/standalone/`

3. **Test the health check** by starting the dev server and visiting `http://localhost:3000/api/health`. Verify it returns a JSON response with database status.

4. **Test the custom server** by running `npx tsx src/server.ts` and verify:
   - The HTTP server starts and serves Next.js pages
   - WebSocket connections can be established at `ws://localhost:3000/ws/annotations`

5. **Run the deploy checklist**: `npx tsx scripts/deploy-checklist.ts` and verify all checks pass

6. **Test Docker build locally** (optional but recommended):
   ```bash
   docker build -t bible-study-app .
   docker run -p 3000:3000 -v bible-study-data:/data bible-study-app
   ```
   Verify the app starts, health check responds, and the persistent volume is working.

7. **Verify the Dockerfile builds in under 5 minutes** (excluding download time). If it is slow, ensure multi-stage caching is working properly.

---

## Important Notes

- **Bible databases are bundled in the Docker image**, not on the volume. They are read-only and never change. This avoids the need to manually copy them to the volume on first deploy.
- **The app database (app.db) MUST be on the persistent volume** at `/data/app.db`. If the volume is not mounted, user data will be lost on every deploy.
- **Railway persistent volumes** survive deploys and container restarts but NOT service deletion. Always maintain backups.
- **The custom server is needed for WebSocket support.** Railway supports long-lived connections, but the standard Next.js server does not handle WebSocket upgrades.
- **Railway provides automatic SSL** for both generated domains (*.up.railway.app) and custom domains. No manual certificate management needed.
- **Railway's $5/month Starter plan** includes 500 hours of execution, 512MB RAM, and 1GB storage. This is sufficient for a small community app. Monitor usage in the Railway dashboard.
- **Do NOT commit actual environment variable values** to version control. The `.env` file should be in `.gitignore`. Only `.env.example` (with placeholder values) should be committed.
- **The health check endpoint is critical** for Railway's deployment health monitoring. If the health check fails, Railway will not route traffic to the new deployment.
