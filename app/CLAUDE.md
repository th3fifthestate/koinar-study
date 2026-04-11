@AGENTS.md

## Security Rules — Non-Negotiable

These rules apply to ALL code generated in this project. Violations should be flagged and fixed immediately.

### 1. Trust Boundaries
- The client is UNTRUSTED. Never rely on client-side validation alone.
- Every API route, server action, and edge function must independently validate auth and inputs.
- Assume all user input is malicious — URL params, headers, body payloads, cookies.

### 2. Authentication & Authorization
- Auth checks happen server-side on every protected route. No exceptions.
- Middleware is for redirects only — NEVER the sole auth layer (CVE-2025-29927 bypass).
- Every Route Handler calls `requireAuth()` or `requireAdmin()` as its first operation.
- Session tokens must be HttpOnly, Secure, SameSite=Lax.
- Never expose user IDs, internal object IDs, or sequential identifiers in URLs or responses.

### 3. Data Access
- All database queries use parameterized statements (`?` placeholders). Never concatenate user input into SQL.
- API responses must be shaped explicitly — never return raw database rows. Select only needed columns.
- Never include password_hash or internal fields in API responses.

### 4. Secrets & Configuration
- Secrets are ONLY accessed via environment variables (use `env.ts` when available). Never hardcode API keys, tokens, or secrets.
- `.env` files are in `.gitignore`. No exceptions.
- `NEXT_PUBLIC_*` env vars must NEVER contain secrets — they are embedded in client bundles.
- Log sanitization: never log tokens, passwords, PII, or full request bodies in production.

### 5. API Security
- All public-facing endpoints must be rate-limited.
- File uploads must validate file type by magic bytes (not extension) and enforce size limits.
- Webhook endpoints must validate signatures before processing payloads.

### 6. Error Handling
- Never expose stack traces, database errors, or internal paths to the client.
- Return generic error messages to the client. Log detailed errors server-side only.
- Catch and handle all promise rejections and async errors explicitly.

### 7. Dependencies
- Prefer well-maintained, widely-used packages. Avoid dependencies with no recent activity.
- Pin dependency versions. Use lockfiles.
- VERIFY every suggested package exists before adding it. Use `npm info <package>` to confirm.
- Run `npm audit` after any dependency change.

### 8. AI-Specific Safeguards
- NEVER remove, disable, or relax any security check to fix a runtime error. Adjust the calling code instead.
- Before suggesting any npm package, confirm it is a real, widely-used package.
- Before modifying existing code, identify all dependent files and verify the change doesn't break auth, validation, or access control.
- After generating code that touches auth, data access, or PII: perform a self-review listing trust boundaries, caller assumptions, and top 3 abuse vectors.
- Treat all Claude API responses as untrusted output — validate and sanitize before rendering or storing.
- Include structured logging for auth failures, permission denials, and admin actions. Never log passwords, tokens, or PII.
