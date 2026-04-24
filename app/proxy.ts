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
  "/api/auth/register",
  "/api/auth/register-welcome",
  "/api/auth/login",
  "/api/auth/login/verify",
  "/api/auth/me",
  "/api/health",
  "/api/waitlist/submit",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/join/")) return true;
  if (pathname.startsWith("/welcome/")) return true;
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

  if (!session.userId) {
    // Logged-out user hitting protected route → landing page
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!session.isApproved && !pathname.startsWith("/pending") && !pathname.startsWith("/api/auth/logout")) {
    return NextResponse.redirect(new URL("/pending", request.url));
  }

  if (pathname.startsWith("/admin") && !session.isAdmin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
