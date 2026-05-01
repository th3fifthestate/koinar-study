// app/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const session = await getSession();
    await session.destroy();
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ route: '/api/auth/logout', err }, 'Logout failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
