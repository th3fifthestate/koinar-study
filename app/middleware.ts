// app/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/lib/auth/session";
import { sessionOptions } from "@/lib/auth/session";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/about",
  "/api/auth/register",
  "/api/auth/register-welcome",
  "/api/auth/login",
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(
    request,
    response,
    sessionOptions
  );

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
