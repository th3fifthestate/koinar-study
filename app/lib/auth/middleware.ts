// app/lib/auth/middleware.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import type { SessionData } from "@/lib/auth/session";

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
  return result;
}
