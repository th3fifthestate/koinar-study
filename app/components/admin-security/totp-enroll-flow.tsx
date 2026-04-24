'use client';

// components/admin-security/totp-enroll-flow.tsx
//
// Admin-only UI for managing TOTP step-up. Three states, driven by
// /api/admin/step-up/status:
//   1. Not enrolled → "Set up authenticator" button → /enroll (QR) →
//      /enroll/confirm (code) → show backup codes ONCE.
//   2. Enrolled, no active step-up → "Unlock admin mode" button.
//   3. Enrolled with active step-up → show expiry + "Lock now" button.
//
// Recovery: if the admin loses their authenticator AND their backup codes,
// they SSH into the Railway box and run `npx tsx scripts/admin-reset-totp.ts`.
// That script is intentionally not reachable from the app.

import { useEffect, useRef, useState } from 'react';
import { StepUpModal } from './step-up-modal';

type Status = {
  enrolled: boolean;
  enrolledAt: string | null;
  stepUpExpiresAt: string | null;
  unusedBackupCodes: number;
};

type EnrollStage =
  | { kind: 'idle' }
  | { kind: 'loading-qr' }
  | { kind: 'awaiting-code'; qrDataUrl: string }
  | { kind: 'confirming'; qrDataUrl: string }
  | { kind: 'show-backup-codes'; codes: string[] }
  | { kind: 'error'; message: string };

export function TotpEnrollFlow() {
  const [status, setStatus] = useState<Status | null>(null);
  const [stage, setStage] = useState<EnrollStage>({ kind: 'idle' });
  const [confirmCode, setConfirmCode] = useState('');
  const [showStepUp, setShowStepUp] = useState(false);

  async function refreshStatus() {
    try {
      const res = await fetch('/api/admin/step-up/status');
      if (res.ok) {
        setStatus((await res.json()) as Status);
      }
    } catch {
      // Status is advisory — silent failure leaves stale local state, which
      // will refresh on the next user action.
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  // ---------------------------------------------------------------------
  // Enrollment flow
  // ---------------------------------------------------------------------

  async function startEnroll() {
    setStage({ kind: 'loading-qr' });
    try {
      const res = await fetch('/api/admin/totp/enroll', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setStage({ kind: 'error', message: body.error ?? 'Enrollment failed.' });
        return;
      }
      const body = (await res.json()) as { qrDataUrl: string };
      setStage({ kind: 'awaiting-code', qrDataUrl: body.qrDataUrl });
      setConfirmCode('');
    } catch {
      setStage({ kind: 'error', message: 'Network error — try again.' });
    }
  }

  async function confirmEnroll() {
    if (stage.kind !== 'awaiting-code') return;
    const code = confirmCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setStage({ kind: 'error', message: 'Enter a 6-digit code from your authenticator.' });
      return;
    }
    const qrDataUrl = stage.qrDataUrl;
    setStage({ kind: 'confirming', qrDataUrl });
    try {
      const res = await fetch('/api/admin/totp/enroll/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setStage({ kind: 'error', message: body.error ?? 'That code did not match.' });
        return;
      }
      const body = (await res.json()) as { backupCodes: string[] };
      setStage({ kind: 'show-backup-codes', codes: body.backupCodes });
      await refreshStatus();
    } catch {
      setStage({ kind: 'error', message: 'Network error — try again.' });
    }
  }

  function finishEnrollment() {
    setStage({ kind: 'idle' });
  }

  // ---------------------------------------------------------------------
  // Step-up session controls
  // ---------------------------------------------------------------------

  async function lockAdminMode() {
    try {
      await fetch('/api/admin/step-up/revoke', { method: 'POST' });
    } finally {
      await refreshStatus();
    }
  }

  function onStepUpVerified() {
    setShowStepUp(false);
    void refreshStatus();
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  if (!status) {
    return <StatusSkeleton />;
  }

  return (
    <div className="border-t border-stone-200 pt-10">
      <span className="font-body text-[0.7rem] uppercase tracking-[0.3em] text-stone-400">
        Two-factor step-up
      </span>
      <h2 className="mt-4 font-display text-2xl md:text-3xl font-normal text-stone-900">
        Admin step-up (TOTP).
      </h2>
      <p className="mt-4 font-body text-base leading-relaxed text-stone-600 max-w-xl">
        Study generation with the platform API key requires a fresh 6-digit code
        from your authenticator app (Authy, 1Password, Google Authenticator, etc.).
        One unlock covers 30 minutes.
      </p>

      {/* Enrolled summary */}
      {status.enrolled && (
        <div className="mt-6 rounded-md border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-body text-sm font-medium text-stone-900">
                Authenticator paired
              </p>
              <p className="mt-1 font-body text-sm text-stone-500">
                {status.unusedBackupCodes} backup code
                {status.unusedBackupCodes === 1 ? '' : 's'} remaining
                {status.stepUpExpiresAt ? (
                  <>
                    {' · '}
                    <span className="text-sage-700">
                      Admin mode unlocked until {formatExpiry(status.stepUpExpiresAt)}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex gap-2">
              {status.stepUpExpiresAt ? (
                <button
                  type="button"
                  onClick={lockAdminMode}
                  className="font-body text-sm px-4 py-2 rounded-md border border-stone-300 text-stone-700 hover:bg-stone-100"
                >
                  Lock now
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowStepUp(true)}
                  className="font-body text-sm font-semibold uppercase tracking-[0.08em] px-4 py-2 rounded-md bg-sage-500 hover:bg-sage-700 text-stone-50"
                >
                  Unlock admin mode
                </button>
              )}
            </div>
          </div>
          {status.unusedBackupCodes <= 2 && (
            <p className="mt-3 font-body text-sm text-amber-700">
              Backup codes running low. If you lose your authenticator, run{' '}
              <code className="font-mono text-xs">scripts/admin-reset-totp.ts</code>{' '}
              over Railway SSH to re-enroll.
            </p>
          )}
        </div>
      )}

      {/* Not-enrolled CTA */}
      {!status.enrolled && stage.kind === 'idle' && (
        <div className="mt-6">
          <button
            type="button"
            onClick={startEnroll}
            className="font-body text-sm font-semibold uppercase tracking-[0.08em] px-4 py-2 rounded-md bg-sage-500 hover:bg-sage-700 text-stone-50"
          >
            Set up authenticator
          </button>
        </div>
      )}

      {/* Enrollment flow UI */}
      {stage.kind === 'loading-qr' && (
        <p className="mt-6 font-body text-sm text-stone-500">Preparing QR code…</p>
      )}

      {(stage.kind === 'awaiting-code' || stage.kind === 'confirming') && (
        <div className="mt-6 rounded-md border border-stone-200 bg-white p-5">
          <p className="font-body text-sm text-stone-700">
            1. Scan the QR code with your authenticator app.
          </p>
          <img
            src={stage.qrDataUrl}
            alt="TOTP QR code"
            className="mt-3 h-64 w-64 rounded border border-stone-200"
          />
          <p className="mt-4 font-body text-sm text-stone-700">
            2. Enter the 6-digit code it displays to confirm.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              disabled={stage.kind === 'confirming'}
              placeholder="123456"
              className="flex-1 max-w-[8rem] rounded-md border border-stone-300 bg-white px-3 py-2 font-body text-base text-stone-900 placeholder:text-stone-400 focus:border-sage-500 focus:outline-none focus:ring-1 focus:ring-sage-500"
            />
            <button
              type="button"
              onClick={confirmEnroll}
              disabled={stage.kind === 'confirming'}
              className="font-body text-sm font-semibold uppercase tracking-[0.08em] px-4 py-2 rounded-md bg-sage-500 hover:bg-sage-700 text-stone-50 disabled:opacity-50"
            >
              {stage.kind === 'confirming' ? 'Confirming…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {stage.kind === 'show-backup-codes' && (
        <BackupCodesPanel codes={stage.codes} onDone={finishEnrollment} />
      )}

      {stage.kind === 'error' && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4">
          <p className="font-body text-sm text-red-800">{stage.message}</p>
          <button
            type="button"
            onClick={() => setStage({ kind: 'idle' })}
            className="mt-2 font-body text-sm text-red-900 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Step-up modal */}
      {showStepUp && (
        <StepUpModal
          onVerified={onStepUpVerified}
          onCancel={() => setShowStepUp(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusSkeleton() {
  return (
    <div className="border-t border-stone-200 pt-10">
      <div className="h-4 w-40 rounded bg-stone-200" />
      <div className="mt-4 h-8 w-64 rounded bg-stone-200" />
      <div className="mt-4 h-4 w-96 rounded bg-stone-200" />
    </div>
  );
}

function BackupCodesPanel({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  function copyAll() {
    void navigator.clipboard.writeText(codes.join('\n'));
  }

  return (
    <div
      ref={ref}
      className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-5"
      role="alert"
      aria-live="polite"
    >
      <p className="font-body text-sm font-medium text-amber-900">
        Save these backup codes. They are shown once.
      </p>
      <p className="mt-1 font-body text-sm text-amber-800">
        Each code works one time. Use one if you lose your authenticator.
        If you also lose these, you will need Railway SSH to reset.
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm text-stone-900">
        {codes.map((c) => (
          <li
            key={c}
            className="rounded border border-amber-200 bg-stone-50 px-3 py-2"
          >
            {c}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copyAll}
          className="font-body text-sm px-3 py-1.5 rounded-md border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
        >
          Copy all
        </button>
        <label className="inline-flex items-center gap-2 font-body text-sm text-stone-700">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          I have saved these codes
        </label>
        <button
          type="button"
          onClick={onDone}
          disabled={!acknowledged}
          className="font-body text-sm font-semibold uppercase tracking-[0.08em] px-4 py-2 rounded-md bg-sage-500 hover:bg-sage-700 text-stone-50 disabled:opacity-50"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function formatExpiry(iso: string): string {
  // SQLite returns "YYYY-MM-DD HH:MM:SS" (UTC, no TZ marker). Browsers
  // parse that as LOCAL — which is actually fine for display because the
  // admin cares about local wall-clock time. Convert explicitly through
  // new Date() to render a short HH:MM.
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
