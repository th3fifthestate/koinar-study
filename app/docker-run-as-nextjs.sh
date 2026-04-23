#!/bin/sh
# Run a command inside the container as the non-root `nextjs` user.
#
# Why this exists:
#   `railway ssh` opens a shell as ROOT inside the running container.
#   Any file a root-run command creates (notably SQLite's WAL/SHM files,
#   which are recreated dynamically on write) is owned by root. The
#   Next.js server runs as `nextjs` (uid 1001) and then hits
#   `SQLITE_READONLY: attempt to write a readonly database`.
#
#   Wrap every DB-writing one-off in this helper so the script runs with
#   the same uid/gid as the server:
#
#     railway ssh -- run-as-nextjs tsx scripts/import-tipnr.ts
#     railway ssh -- run-as-nextjs env ADMIN_EMAIL=… tsx scripts/create-admin.ts
#
# If you forgot and the server is already broken, run `fix-db-perms`.
set -e
exec su-exec nextjs:nodejs "$@"
