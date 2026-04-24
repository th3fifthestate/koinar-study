// app/lib/auth/middleware.ts
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import type { SessionData } from "@/lib/auth/session";
import { hasValidStepUpSession } from "@/lib/auth/step-up";

/**
 * Absolute ceiling on admin session age. Independent of the 7-day cookie
 * TTL — a compromised admin cookie is useful for at most 24 hours, after
 * which requireAdmin() forces a full re-login (password + TOTP).
 */
const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Call as first operation in every protected Route Handler.
 *  Returns { user } on success, { response } (401) on failure. */
export async function requireAuth(): Promise<
  { user: SessionData; response: null } | { user: null; response: NextResponse }
> {
  const session = await getSession();
  if (!session.userId) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!session.isApproved) {
    return {
      user: null,
      response: NextResponse.json({ error: "Account pending approval" }, { status: 403 }),
    };
  }
  return {
    user: {
      userId: session.userId,
      username: session.username,
      isAdmin: session.isAdmin,
      isApproved: session.isApproved,
      onboardingCompleted: session.onboardingCompleted,
    },
    response: null,
  };
}

/** Call as first operation in every admin-only Route Handler. */
export async function requireAdmin(): Promise<
  { user: SessionData; response: null } | { user: null; response: NextResponse }
> {
  const result = await requireAuth();
  if (result.response) return result;
  if (!result.user.isAdmin) {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  // Enforce absolute admin session ceiling. Legacy sessions without
  // adminLoginAt (minted before this field existed) or any session older
  // than ADMIN_SESSION_TTL_MS gets destroyed; the admin must complete a
  // fresh password + TOTP login.
  const session = await getSession();
  const loginAt = session.adminLoginAt ?? 0;
  if (Date.now() - loginAt > ADMIN_SESSION_TTL_MS) {
    session.destroy();
    return {
      user: null,
      response: NextResponse.json(
        { error: "Admin session expired. Please sign in again." },
        { status: 401 }
      ),
    };
  }
  return result;
}

/**
 * Gate that layers TOTP step-up on top of requireAdmin. Use on high-cost or
 * high-blast-radius endpoints that use the platform Anthropic key
 * (currently: /api/study/generate when the caller is admin).
 *
 * Sequence:
 *   1. requireAdmin (also covers requireAuth + approval check)
 *   2. hasValidStepUpSession — a row in admin_step_up_sessions with
 *      expires_at in the future, created by POST /api/admin/step-up/verify.
 *
 * On step-up miss we return 403 with `code: "STEP_UP_REQUIRED"` so the UI
 * can distinguish this from a generic Forbidden and pop the TOTP modal.
 * Non-admin callers never hit this path — requireAdmin short-circuits them
 * with a plain 403, not STEP_UP_REQUIRED.
 */
export async function requireAdminStepUp(): Promise<
  { user: SessionData; response: null } | { user: null; response: NextResponse }
> {
  const result = await requireAdmin();
  if (result.response) return result;
  if (!hasValidStepUpSession(result.user.userId)) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Step-up verification required", code: "STEP_UP_REQUIRED" },
        { status: 403 }
      ),
    };
  }
  return result;
}

/**
 * Server-component gate for admin pages. Redirects to '/' if the caller is
 * not a signed-in admin. Use as the first operation in every admin-facing
 * page.tsx — this is defense in depth on top of app/admin/layout.tsx, so a
 * future layout refactor or mis-applied route group can't silently expose
 * admin pages.
 *
 * Returns the session on success; never returns on failure (redirect throws).
 */
export async function requireAdminPage(): Promise<SessionData> {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    redirect("/");
  }
  // Same absolute ceiling as requireAdmin — stale admin sessions get
  // destroyed and the user bounces to home, where /login is one click away.
  const loginAt = session.adminLoginAt ?? 0;
  if (Date.now() - loginAt > ADMIN_SESSION_TTL_MS) {
    session.destroy();
    redirect("/");
  }
  return {
    userId: session.userId,
    username: session.username,
    isAdmin: session.isAdmin,
    isApproved: session.isApproved,
    onboardingCompleted: session.onboardingCompleted,
  };
}
