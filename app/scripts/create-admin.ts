/**
 * Create (or re-verify) an admin account.
 *
 * Reads required env vars:
 *   ADMIN_EMAIL         — email the 2FA code goes to
 *   ADMIN_USERNAME      — URL-safe handle
 *   ADMIN_DISPLAY_NAME  — shown in the UI
 *
 * Generates a cryptographically random 24-character password, hashes it with
 * argon2id (same settings as the login route), and inserts a user row with
 * is_admin = 1, is_approved = 1, onboarding_completed = 1.
 *
 * Idempotent on username: if the row already exists and is already flagged
 * admin, the script prints a reminder and exits 0 without rotating the
 * password (so you don't accidentally lock yourself out on a rerun). If it
 * exists but is NOT admin, it upgrades the flags in place — password is not
 * touched.
 *
 * The generated password is printed ONCE to stdout. It is not stored
 * anywhere else. Copy it to a password manager immediately.
 *
 * Run: cd app && \
 *   ADMIN_EMAIL=you@koinar.app ADMIN_USERNAME=admin ADMIN_DISPLAY_NAME="Koinar Admin" \
 *   npx tsx scripts/create-admin.ts
 */

import { randomBytes } from 'crypto';
import { getDb } from '../lib/db/connection';
import { hashPassword } from '../lib/auth/password';

function generatePassword(): string {
  // 18 bytes → 24 chars of url-safe base64 (no padding). Strong enough for
  // an admin login behind 2FA; the 6-digit code is the real second factor.
  return randomBytes(18)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`error: ${name} is required`);
    process.exit(1);
  }
  return v.trim();
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isValidUsername(s: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{1,29}$/i.test(s);
}

async function main() {
  const email = requireEnv('ADMIN_EMAIL').toLowerCase();
  const username = requireEnv('ADMIN_USERNAME');
  const displayName = requireEnv('ADMIN_DISPLAY_NAME');

  if (!isValidEmail(email)) {
    console.error(`error: ADMIN_EMAIL is not a valid email: ${email}`);
    process.exit(1);
  }
  if (!isValidUsername(username)) {
    console.error(
      `error: ADMIN_USERNAME must be 2-30 chars, alphanumeric plus _ and -`
    );
    process.exit(1);
  }

  const db = getDb();

  // Look up by username and by email separately. If either points to a row
  // but the row's other field doesn't match the inputs, abort — the OR-match
  // pattern here would otherwise let a rerun silently promote a regular user
  // to admin if the new username happens to collide with an existing email
  // (or vice versa).
  const byUsername = db
    .prepare('SELECT id, username, email, is_admin FROM users WHERE username = ?')
    .get(username) as { id: number; username: string; email: string; is_admin: number } | undefined;
  const byEmail = db
    .prepare('SELECT id, username, email, is_admin FROM users WHERE email = ?')
    .get(email) as { id: number; username: string; email: string; is_admin: number } | undefined;

  if (byUsername && byEmail && byUsername.id !== byEmail.id) {
    console.error(
      `error: username "${username}" and email "${email}" point to different rows (id=${byUsername.id} vs id=${byEmail.id}). Aborting to prevent accidental admin promotion.`
    );
    process.exit(1);
  }

  const existing = byUsername ?? byEmail;
  if (existing) {
    const usernameMatch = existing.username.toLowerCase() === username.toLowerCase();
    const emailMatch = existing.email.toLowerCase() === email;
    if (!usernameMatch || !emailMatch) {
      console.error(
        `error: found partial match (id=${existing.id}, username=${existing.username}, email=${existing.email}).`
      );
      console.error(
        `Either username or email matches an existing user but the other differs. Aborting to prevent accidental admin promotion.`
      );
      process.exit(1);
    }

    if (existing.is_admin === 1) {
      console.log(
        `Admin user already exists (id=${existing.id}). Password unchanged.`
      );
      console.log(
        `If you've lost the password, delete the row and rerun this script:`
      );
      console.log(`  sqlite3 <db> "DELETE FROM users WHERE id=${existing.id};"`);
      process.exit(0);
    }
    // Both fields match an existing non-admin row — upgrade flags in place.
    db.prepare(
      `UPDATE users
       SET is_admin = 1,
           is_approved = 1,
           onboarding_completed = 1,
           display_name = COALESCE(display_name, ?)
       WHERE id = ?`
    ).run(displayName, existing.id);
    console.log(
      `Existing user id=${existing.id} upgraded to admin. Password unchanged.`
    );
    process.exit(0);
  }

  const password = generatePassword();
  const hash = await hashPassword(password);

  const info = db
    .prepare(
      `INSERT INTO users (
         username, email, password_hash, display_name,
         is_admin, is_approved, onboarding_completed
       ) VALUES (?, ?, ?, ?, 1, 1, 1)`
    )
    .run(username, email, hash, displayName);

  console.log('');
  console.log('  Admin account created');
  console.log('  ─────────────────────');
  console.log(`  id:            ${info.lastInsertRowid}`);
  console.log(`  username:      ${username}`);
  console.log(`  email:         ${email}`);
  console.log(`  display_name:  ${displayName}`);
  console.log('');
  console.log('  Password (shown once — save it now):');
  console.log('');
  console.log(`    ${password}`);
  console.log('');
  console.log('  Sign in at https://koinar.app — a 6-digit code will be');
  console.log(`  emailed to ${email} to complete the login.`);
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
