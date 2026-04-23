#!/bin/sh
set -e

# Railway mounts persistent volumes owned by root. The app runs as the
# non-root `nextjs` user (uid 1001), so the mount must be chowned before
# SQLite can create/write app.db. Do this once at boot, then drop privileges.
#
# Note: the volume mounts at /app/db (NOT /app/data). /app/data is
# reserved for image-baked seed source (JSON + TSV) used by one-off
# seed scripts; if the volume were mounted at /app/data it would shadow
# those files and the scripts would fail.

mkdir -p /app/db
chown -R nextjs:nodejs /app/db

exec su-exec nextjs:nodejs "$@"
