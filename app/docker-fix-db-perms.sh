#!/bin/sh
# Emergency repair: restore nextjs:nodejs ownership on the DB volume.
#
# Use this if a seed/admin script was run via `railway ssh` WITHOUT the
# `run-as-nextjs` wrapper, and the Next.js server is now hitting
# `SQLITE_READONLY: attempt to write a readonly database`.
#
#   railway ssh -- fix-db-perms
#
# This is idempotent and safe to run at any time.
set -e

if [ ! -d /app/db ]; then
  echo "✗ /app/db does not exist — is the volume mounted?" >&2
  exit 1
fi

chown -R nextjs:nodejs /app/db
echo "✓ /app/db and contents now owned by nextjs:nodejs"
ls -la /app/db
