// app/lib/auth/password.ts
import * as argon2 from "argon2";
import { getDb } from "@/lib/db/connection";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export function isAccountLocked(userId: number): boolean {
  const user = getDb()
    .prepare("SELECT failed_login_attempts, locked_until FROM users WHERE id = ?")
    .get(userId) as { failed_login_attempts: number; locked_until: string | null } | undefined;
  if (!user || !user.locked_until) return false;
  if (new Date(user.locked_until) > new Date()) return true;
  // Lock expired — reset
  getDb()
    .prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?")
    .run(userId);
  return false;
}

export function recordFailedLogin(userId: number): void {
  const user = getDb()
    .prepare("SELECT failed_login_attempts FROM users WHERE id = ?")
    .get(userId) as { failed_login_attempts: number } | undefined;
  if (!user) return;
  const newCount = user.failed_login_attempts + 1;
  if (newCount >= MAX_ATTEMPTS) {
    const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
    getDb()
      .prepare("UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?")
      .run(newCount, lockUntil, userId);
  } else {
    getDb()
      .prepare("UPDATE users SET failed_login_attempts = ? WHERE id = ?")
      .run(newCount, userId);
  }
}

export function resetFailedLogins(userId: number): void {
  getDb()
    .prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?")
    .run(userId);
}

/** Returns minutes remaining on lockout, or 0 if not locked */
export function getLockoutMinutesRemaining(userId: number): number {
  const user = getDb()
    .prepare("SELECT locked_until FROM users WHERE id = ?")
    .get(userId) as { locked_until: string | null } | undefined;
  if (!user?.locked_until) return 0;
  const remaining = new Date(user.locked_until).getTime() - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 60000) : 0;
}
