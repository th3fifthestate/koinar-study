import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth protection will be implemented in Brief 02.
// This stub ensures Next.js picks up the middleware file.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
