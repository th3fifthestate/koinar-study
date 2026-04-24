/**
 * Emergency TOTP reset for an admin locked out of their 2FA.
 *
 * Runs ONLY from a Railway SSH session or controlled ops shell. There is no
 * in-app path to this script — that is deliberate. If an attacker compromised
 * an admin password, they must also have access to the Railway deployment
 * shell to clear the TOTP gate. The script also refuses to run without an
 * explicit RAILWAY_RESET_CONFIRM=1 env var, so an accidental local `npx tsx`
 * invocation is a no-op.
 *
 * What it does, atomically:
 *   1. Clears users.totp_secret and users.totp_enrolled_at on the target admin.
 *   2. Deletes every row in admin_totp_backup_codes for that user.
 *   3. Revokes any active admin_step_up_sessions for that user.
 *   4. Writes an admin_actions row for audit (action_type='totp_reset_via_ssh').
 *
 * After this, the admin logs in normally, visits Settings → Admin, and enrolls
 * a fresh TOTP secret. Step-up-gated endpoints (e.g. /api/study/generate in
 * admin mode) will return 403 STEP_UP_REQUIRED until they do.
 *
 * Usage (on Railway SSH):
 *   cd app && \
 *     RAILWAY_RESET_CONFIRM=1 \
 *     npx tsx scripts/admin-reset-totp.ts \
 *       --username admin \
 *       --reason "lost authenticator on phone swap"
 *
 * Both --username and --reason are required. The reason is written into the
 * admin_actions.details row so a later audit can explain why the reset happened.
 */

import { getDb } from '../lib/db/connection';

interface Args {
  username: string;
  reason: string;
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--username') {
      out.username = argv[++i];
    } else if (arg === '--reason') {
      out.reason = argv[++i];
    } else if (arg.startsWith('--username=')) {
      out.username = arg.slice('--username='.length);
    } else if (arg.startsWith('--reason=')) {
      out.reason = arg.slice('--reason='.length);
    } else if (arg === '--help' || arg === '-h') {
      printHelpAndExit(0);
    }
  }
  if (!out.username || !out.username.trim()) {
    console.error('error: --username is required');
    printHelpAndExit(1);
  }
  if (!out.reason || !out.reason.trim()) {
    console.error('error: --reason is required (written to the audit log)');
    printHelpAndExit(1);
  }
  if (out.reason.length > 500) {
    console.error('error: --reason must be 500 characters or less');
    process.exit(1);
  }
  return { username: out.username.trim(), reason: out.reason.trim() };
}

function printHelpAndExit(code: number): never {
  console.error('');
  console.error('  Usage:');
  console.error('    RAILWAY_RESET_CONFIRM=1 npx tsx scripts/admin-reset-totp.ts \\');
  console.error('      --username <username> \\');
  console.error('      --reason "<why this reset is happening>"');
  console.error('');
  process.exit(code);
}

function main() {
  if (process.env.RAILWAY_RESET_CONFIRM !== '1') {
    console.error(
      'error: RAILWAY_RESET_CONFIRM=1 is required to run this script.'
    );
    console.error(
      'This gate prevents accidental local invocation. If you are on Railway SSH,'
    );
    console.error('re-run with RAILWAY_RESET_CONFIRM=1 prefixed.');
    process.exit(1);
  }

  const { username, reason } = parseArgs(process.argv.slice(2));

  const db = getDb();

  const user = db
    .prepare(
      'SELECT id, username, email, is_admin, totp_enrolled_at FROM users WHERE username = ?'
    )
    .get(username) as
    | {
        id: number;
        username: string;
        email: string;
        is_admin: number;
        totp_enrolled_at: string | null;
      }
    | undefined;

  if (!user) {
    console.error(`error: no user found with username "${username}"`);
    process.exit(1);
  }

  if (user.is_admin !== 1) {
    console.error(
      `error: user id=${user.id} is not an admin. Refusing to reset — this script is admin-only.`
    );
    process.exit(1);
  }

  const wasEnrolled = user.totp_enrolled_at !== null;

  // All four writes happen in one transaction so a partial state can never
  // leave the admin locked out (e.g. secret cleared but backup codes intact).
  const run = db.transaction(() => {
    db.prepare(
      'UPDATE users SET totp_secret = NULL, totp_enrolled_at = NULL WHERE id = ?'
    ).run(user.id);

    const backupCodesDeleted = db
      .prepare('DELETE FROM admin_totp_backup_codes WHERE user_id = ?')
      .run(user.id).changes;

    const sessionsDeleted = db
      .prepare('DELETE FROM admin_step_up_sessions WHERE user_id = ?')
      .run(user.id).changes;

    db.prepare(
      `INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, details)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      user.id, // self-reset via ops shell; no other admin in scope
      'totp_reset_via_ssh',
      'user',
      user.id,
      JSON.stringify({
        reason,
        was_enrolled: wasEnrolled,
        backup_codes_deleted: backupCodesDeleted,
        step_up_sessions_revoked: sessionsDeleted,
      })
    );

    return { backupCodesDeleted, sessionsDeleted };
  });

  const { backupCodesDeleted, sessionsDeleted } = run();

  console.log('');
  console.log('  TOTP reset complete');
  console.log('  ───────────────────');
  console.log(`  user id:              ${user.id}`);
  console.log(`  username:             ${user.username}`);
  console.log(`  email:                ${user.email}`);
  console.log(`  was enrolled:         ${wasEnrolled ? 'yes' : 'no'}`);
  console.log(`  backup codes wiped:   ${backupCodesDeleted}`);
  console.log(`  step-up sessions:     ${sessionsDeleted} revoked`);
  console.log('');
  console.log('  Next steps for the admin:');
  console.log('    1. Sign in at https://koinar.app as usual.');
  console.log('    2. Visit Settings → Admin.');
  console.log('    3. Enroll a fresh authenticator and save the new backup codes.');
  console.log('');
  console.log(
    '  Admin-gated endpoints (e.g. /api/study/generate in admin mode) will'
  );
  console.log(
    '  return 403 STEP_UP_REQUIRED until the admin re-enrolls and verifies.'
  );
  console.log('');
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
