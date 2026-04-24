// app/lib/auth/session.ts
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { config } from "@/lib/config";

export interface SessionData {
  userId: number;
  username: string;
  displayName?: string;
  isAdmin: boolean;
  isApproved: boolean;
  onboardingCompleted: boolean;
  /**
   * FUMS session ID — minted once per login via newFumsSessionId(). Passed to
   * api.bible's /f3 Fair Use Monitoring endpoint as `sId`, which expects "a
   * unique random ID per session, regenerated each session" per
   * https://docs.api.bible/guides/fair-use/.
   *
   * Optional at the type level so legacy seal-data with no sessionId parses
   * cleanly; flushFumsEvents() treats null as a synthetic "pre-sessionid"
   * session so events recorded before this field was added still ship.
   */
  sessionId?: string;
  /**
   * Unix ms timestamp captured when an admin completes TOTP step 2 of login.
   * Used by requireAdmin() to enforce a 24-hour absolute ceiling on admin
   * sessions — much shorter than the 7-day user TTL. Absent for non-admins
   * and for legacy admin sessions predating this field (in which case the
   * requireAdmin gate refuses them and forces a fresh login).
   */
  adminLoginAt?: number;
}

export const sessionOptions = {
  password: config.session.secret,
  cookieName: config.session.cookieName,
  cookieOptions: {
    httpOnly: true,
    // Secure cookies in any non-dev/test environment. Staging serves over
    // HTTPS (Cloudflare Access) so default to closed rather than keying on
    // a single "production" literal.
    secure: !["development", "test"].includes(process.env.NODE_ENV ?? ""),
    sameSite: "lax" as const,
    path: "/",
    maxAge: config.session.ttlDays * 24 * 60 * 60,
  },
};

/** For use in Server Components and Route Handlers */
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/** Returns current user from session, null if not logged in */
export async function getCurrentUser(): Promise<SessionData | null> {
  const session = await getSession();
  if (!session.userId) return null;
  return {
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
    isAdmin: session.isAdmin,
    isApproved: session.isApproved,
    onboardingCompleted: session.onboardingCompleted,
    sessionId: session.sessionId,
  };
}
