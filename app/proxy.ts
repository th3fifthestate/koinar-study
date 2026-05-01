// app/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/lib/auth/session";
import { sessionOptions } from "@/lib/auth/session";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/about",
  "/privacy",
  "/terms",
  "/attributions",
  "/contact",
  "/api/auth/register",
  "/api/auth/register-welcome",
  "/api/auth/login",
  "/api/auth/login/verify",
  // Forgot/reset password flows must be reachable when logged out — that's
  // the whole point. Each endpoint enforces its own rate limit and token
  // claim atomicity; see the route handlers.
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/me",
  "/api/health",
  "/api/contact",
  "/api/waitlist/submit",
  "/api/waitlist/notify",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/join/")) return true;
  if (pathname.startsWith("/welcome/")) return true;
  // Password-reset email links: /reset/<token>. The page is server-rendered
  // and pre-validates the token before showing the form; allowing logged-out
  // access is required for the flow to function.
  if (pathname.startsWith("/reset/")) return true;
  if (pathname.startsWith("/api/join/")) return true;
  if (pathname.startsWith("/api/verses")) return true;
  if (pathname.startsWith("/study/")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/fonts")) return true;
  if (pathname.startsWith("/images")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(
    request,
    response,
    sessionOptions
  );

  // Onboarding gate runs before the public-path shortcut so that a logged-in user
  // hitting the logged-in library at "/" is still redirected into onboarding.
  // Exempt: the onboarding page, the completion API, logout, and auth-related routes.
  // Only redirect when the flag is explicitly false — legacy sessions (undefined)
  // predate this field and are treated as already onboarded.
  const isOnboardingExempt =
    pathname === "/onboarding" ||
    pathname.startsWith("/api/user/onboarding-complete") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/auth/me") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/images") ||
    pathname === "/favicon.ico";
  if (session.userId && session.isApproved && session.onboardingCompleted === false && !isOnboardingExempt) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  if (isPublicPath(pathname)) return response;

  // For API requests (or any non-GET — POST/PUT/DELETE shouldn't be redirected
  // because following a 307 turns it back into the same verb against an HTML
  // page), return JSON status codes so fetch() callers branch correctly.
  // Page navigations still get the friendly redirect to /.
  const isApiOrMutation =
    pathname.startsWith("/api/") || request.method !== "GET";

  if (!session.userId) {
    if (isApiOrMutation) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!session.isApproved && !pathname.startsWith("/pending") && !pathname.startsWith("/api/auth/logout")) {
    if (isApiOrMutation) {
      return NextResponse.json({ error: "Account pending approval" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/pending", request.url));
  }

  if (pathname.startsWith("/admin") && !session.isAdmin) {
    if (isApiOrMutation) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
