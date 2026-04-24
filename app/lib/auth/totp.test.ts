// app/lib/auth/totp.test.ts
import { describe, it, expect } from 'vitest';
import { generateSync } from 'otplib';
import {
  generateTotpSecret,
  buildProvisioningUri,
  buildProvisioningQr,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCode,
} from './totp';

describe('generateTotpSecret', () => {
  it('returns a non-empty base32 string', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it('returns a different secret on each call', () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe('buildProvisioningUri', () => {
  it('encodes username, issuer, and secret into an otpauth URI', () => {
    const secret = generateTotpSecret();
    const uri = buildProvisioningUri('alice', secret);
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('Koinar');
    expect(uri).toContain('alice');
    expect(uri).toContain(`secret=${secret}`);
  });
});

describe('buildProvisioningQr', () => {
  it('returns a base64 PNG data URL', async () => {
    const secret = generateTotpSecret();
    const uri = buildProvisioningUri('alice', secret);
    const dataUrl = await buildProvisioningQr(uri);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(dataUrl.length).toBeGreaterThan(200);
  });
});

describe('verifyTotpCode', () => {
  it('accepts a freshly-generated code for the same secret', () => {
    const secret = generateTotpSecret();
    const code = generateSync({ secret });
    expect(verifyTotpCode(code, secret)).toBe(true);
  });

  it('rejects a code generated for a different secret', () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const codeB = generateSync({ secret: secretB });
    expect(verifyTotpCode(codeB, secretA)).toBe(false);
  });

  it('rejects malformed input without throwing', () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode('', secret)).toBe(false);
    expect(verifyTotpCode('123', secret)).toBe(false);
    expect(verifyTotpCode('abcdef', secret)).toBe(false);
    expect(verifyTotpCode('1234567', secret)).toBe(false);
  });

  it('rejects codes with non-digit characters', () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode('12a456', secret)).toBe(false);
    expect(verifyTotpCode(' 12345', secret)).toBe(false);
  });

  it('accepts a code generated 30s in the past (drift tolerance)', () => {
    const secret = generateTotpSecret();
    const pastEpoch = Math.floor(Date.now() / 1000) - 30;
    const pastCode = generateSync({ secret, epoch: pastEpoch });
    expect(verifyTotpCode(pastCode, secret)).toBe(true);
  });

  it('rejects a code generated well outside the drift window', () => {
    const secret = generateTotpSecret();
    // Two minutes in the past — well outside the ±30s tolerance.
    const ancientEpoch = Math.floor(Date.now() / 1000) - 120;
    const ancientCode = generateSync({ secret, epoch: ancientEpoch });
    expect(verifyTotpCode(ancientCode, secret)).toBe(false);
  });
});

describe('generateBackupCodes', () => {
  it('generates the requested number of codes', () => {
    const { codes, hashes } = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    expect(hashes).toHaveLength(10);
  });

  it('codes are 20-hex-character strings', () => {
    const { codes } = generateBackupCodes(3);
    for (const code of codes) {
      expect(code).toMatch(/^[0-9a-f]{20}$/);
    }
  });

  it('all codes are unique', () => {
    const { codes } = generateBackupCodes(20);
    expect(new Set(codes).size).toBe(20);
  });

  it('codes[i] hashes to hashes[i]', () => {
    const { codes, hashes } = generateBackupCodes(5);
    for (let i = 0; i < codes.length; i++) {
      expect(hashBackupCode(codes[i])).toBe(hashes[i]);
    }
  });
});

describe('hashBackupCode', () => {
  it('is deterministic', () => {
    expect(hashBackupCode('abcd1234')).toBe(hashBackupCode('abcd1234'));
  });

  it('normalizes whitespace, hyphens, and case', () => {
    const a = hashBackupCode('abcd1234ef56');
    expect(hashBackupCode('ABCD1234EF56')).toBe(a);
    expect(hashBackupCode('abcd-1234-ef56')).toBe(a);
    expect(hashBackupCode('  abcd1234ef56  ')).toBe(a);
    expect(hashBackupCode('abcd 1234 ef56')).toBe(a);
  });

  it('produces a sha256-length hex string', () => {
    expect(hashBackupCode('anything')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different codes produce different hashes', () => {
    expect(hashBackupCode('code-a')).not.toBe(hashBackupCode('code-b'));
  });
});
