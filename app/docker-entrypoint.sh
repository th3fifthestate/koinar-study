#!/bin/sh
set -e

# Railway mounts persistent volumes owned by root. The app runs as the
# non-root `nextjs` user (uid 1001), so the mount must be chowned before
# SQLite can create/write app.db. Do this once at boot, then drop privileges.

mkdir -p /app/data
chown -R nextjs:nodejs /app/data

exec su-exec nextjs:nodejs "$@"
