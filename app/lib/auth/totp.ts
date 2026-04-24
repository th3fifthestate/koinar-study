// app/lib/auth/totp.ts
//
// TOTP (RFC 6238) primitives for admin step-up. Used only on admins to gate
// /api/study/generate when the admin is using the platform Anthropic key.
// This is layered on top of the email-2FA that already runs at login —
// TOTP is a separate, per-endpoint step-up factor bound to a physical
// authenticator (Authy, 1Password, Google Authenticator, etc.) that is NOT
// part of the admin's email account.
//
// Design notes:
//   - SHA-1, 30s step, 6 digits — the universal-compatibility defaults
//     every authenticator app supports (also otplib's defaults). Don't rev
//     these without a migration plan; users' provisioned secrets assume
//     these params.
//   - epochTolerance: 30 = ±30s wall-clock tolerance (≈ ±1 period). Tight
//     enough that a skimmed code is useless seconds later, wide enough to
//     tolerate normal phone clock skew.
//   - Secret is stored in users.totp_secret as a base32 string (same format
//     otpauth:// URIs want). The DB-leak tradeoff is explicit: a reader of
//     the users table also has the Railway box, which already holds
//     ANTHROPIC_API_KEY. TOTP is a step-up, not a stand-alone password.
//   - Backup codes are 10-byte (20-hex-char) random strings, shown to the
//     admin ONCE at enrollment, stored as sha256(code). Used once
//     (consumed_at set). Intended for "lost my phone" recovery without
//     needing Railway SSH. Railway-SSH reset (scripts/admin-reset-totp.ts)
//     is the final fallback if backup codes are also lost.

import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { createHash, randomBytes } from 'crypto';

const ISSUER = 'Koinar';

// ±30s tolerance = roughly ±1 period at the default 30s step. Applies
// symmetrically so the admin can enter a code that just rotated or is
// about to rotate.
const EPOCH_TOLERANCE_SECONDS = 30;

/**
 * Generate a fresh base32 TOTP secret. Call this once at enrollment; the
 * returned string is what gets written to users.totp_secret and encoded
 * into the QR code.
 */
export function generateTotpSecret(): string {
  return generateSecret();
}

/**
 * Build the otpauth:// URI an authenticator app expects. Label is what
 * shows up in the app's account list — username@koinar keeps it unambiguous.
 */
export function buildProvisioningUri(username: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: username, secret });
}

/**
 * Render the provisioning URI as a data: PNG URL for an <img> tag.
 * Returns a base64 data URL (not a binary buffer) so the enrollment route
 * can ship it straight to the client.
 */
export async function buildProvisioningQr(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  });
}

/**
 * Verify a 6-digit TOTP code against a secret. Accepts ±30s wall-clock
 * drift. Returns true on match, false otherwise. Never throws on malformed
 * input — returns false so the caller can respond with a flat 400.
 */
export function verifyTotpCode(code: string, secret: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  try {
    const result = verifySync({
      secret,
      token: code,
      epochTolerance: EPOCH_TOLERANCE_SECONDS,
    });
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * Generate `count` backup codes. Returns the raw codes (for display to the
 * admin ONCE) and their sha256 hashes (for storage). Pair-wise: codes[i]
 * hashes to hashes[i]. Raw codes are 20-hex-char random strings; they have
 * ~80 bits of entropy, which is plenty for a single-use recovery token.
 */
export function generateBackupCodes(
  count: number = 10
): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < count; i++) {
    // 10 bytes → 20 hex chars → ~80 bits of entropy.
    const raw = randomBytes(10).toString('hex');
    codes.push(raw);
    hashes.push(hashBackupCode(raw));
  }
  return { codes, hashes };
}

/**
 * sha256 a backup code. Used both at generation (to store) and at redeem
 * (to compare against the stored hash). Input is normalized — trimmed,
 * lowercased, and stripped of spaces/hyphens so admins can paste codes
 * in any common formatting.
 */
export function hashBackupCode(code: string): string {
  const normalized = code.trim().toLowerCase().replace(/[\s-]/g, '');
  return createHash('sha256').update(normalized).digest('hex');
}
