/**
 * Minimal structured logger.
 *
 * Not pino — no transport config, no pretty-printing, no serializers. Just
 * JSON-per-line to stdout/stderr for Railway's log aggregator, with a small
 * set of curated fields. The full pino/winston toolkit was overkill for the
 * alpha: we're shipping lines, not observability pipelines.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.error({ route: '/api/foo', userId: 42, err }, 'Database write failed');
 *   logger.warn({ route: '/api/foo' }, 'Rate limit hit');
 *   logger.info({ event: 'user_login', userId: 42 });
 *
 * Conventions:
 *   - `route`: the Next.js route path being served, e.g. '/api/admin/users'.
 *   - `event`: a verb_object label for domain-level events (user_login, etc).
 *   - `userId`: numeric user id IF relevant. NEVER usernames, emails, IPs,
 *     tokens, or any other PII.
 *   - `err`: an Error instance — we extract .message + .name only. Stack
 *     traces go to stderr in dev, suppressed in prod to avoid leaking paths.
 *
 * What NEVER appears in a log line (per CLAUDE.md §4):
 *   - passwords, API tokens, session cookies, TOTP secrets, backup codes
 *   - email addresses, IP addresses, user-agent strings, phone numbers
 *   - raw request bodies, raw response bodies
 *   - full SQL statements with parameter values
 *
 * Always pass a structured object FIRST, then a message string. This lets
 * log aggregators parse fields cleanly — the message is for humans skimming
 * the tail, the object is for queries.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function minLevel(): LogLevel {
  const envLevel = (process.env.LOG_LEVEL ?? '').toLowerCase() as LogLevel;
  if (envLevel in LEVEL_RANK) return envLevel;
  // Noisy in dev by default, quiet in prod.
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function enabled(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel()];
}

/** Normalize an Error-like value to safe fields. Drops the stack in prod. */
function serializeError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return { err: String(err) };
  const base: Record<string, unknown> = {
    errName: err.name,
    errMessage: err.message,
  };
  if (process.env.NODE_ENV !== 'production') {
    base.errStack = err.stack;
  }
  return base;
}

type Fields = Record<string, unknown> & { err?: unknown };

function emit(level: LogLevel, fields: Fields | null, message?: string): void {
  if (!enabled(level)) return;
  const { err, ...rest } = fields ?? {};
  const line: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
    ...rest,
  };
  if (err !== undefined) Object.assign(line, serializeError(err));
  if (message) line.msg = message;

  const serialized = JSON.stringify(line);
  if (level === 'error' || level === 'warn') {
    // eslint-disable-next-line no-console -- direct stderr write by design.
    console.error(serialized);
  } else {
    // eslint-disable-next-line no-console -- direct stdout write by design.
    console.log(serialized);
  }
}

export const logger = {
  debug: (fields: Fields | string, message?: string) => {
    if (typeof fields === 'string') emit('debug', null, fields);
    else emit('debug', fields, message);
  },
  info: (fields: Fields | string, message?: string) => {
    if (typeof fields === 'string') emit('info', null, fields);
    else emit('info', fields, message);
  },
  warn: (fields: Fields | string, message?: string) => {
    if (typeof fields === 'string') emit('warn', null, fields);
    else emit('warn', fields, message);
  },
  error: (fields: Fields | string, message?: string) => {
    if (typeof fields === 'string') emit('error', null, fields);
    else emit('error', fields, message);
  },
};
