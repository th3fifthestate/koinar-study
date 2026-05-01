// app/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserById } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ user: null });
    }

    const user = getUserById(sessionUser.userId);
    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        isAdmin: user.is_admin === 1,
        isApproved: user.is_approved === 1,
        onboardingCompleted: user.onboarding_completed === 1,
      },
    });
  } catch (err) {
    logger.error({ route: '/api/auth/me', err }, 'Auth me failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
