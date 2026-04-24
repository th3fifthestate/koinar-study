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
  };
}
