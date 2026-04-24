// app/app/api/gift-codes/redeem/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getGiftCode, getActiveGiftCodesForUser } from "@/lib/db/queries";
import { createRateLimiter } from "@/lib/rate-limit";
import { z } from "zod";
import { logger } from "@/lib/logger";

const redeemSchema = z.object({
  code: z.string().min(1),
});

// Per-user rate limit — gift-code redemption is a credential-check path; cap abuse per user.
const isUserRateLimited = createRateLimiter({ windowMs: 60_000, max: 20 });

// POST /api/gift-codes/redeem — verify a gift code belongs to this user and return its status
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (isUserRateLimited(`user-${auth.user.userId}`)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = redeemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "code field required" }, { status: 400 });
  }

  try {
    const giftCode = getGiftCode(parsed.data.code);

    // Return 404 for both "not found" and "wrong user" to avoid code enumeration
    if (!giftCode || giftCode.user_id !== auth.user.userId) {
      return NextResponse.json({ error: "Gift code not found" }, { status: 404 });
    }

    if (giftCode.uses_remaining <= 0) {
      return NextResponse.json(
        { error: "Gift code has no remaining uses" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      format: giftCode.format_locked,
      remainingUses: giftCode.uses_remaining,
    });
  } catch (err) {
    logger.error(
      { route: "/api/gift-codes/redeem", method: "POST", userId: auth.user.userId, err },
      "Gift code redeem DB error"
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/gift-codes/my-codes — list active gift codes for the current user
export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  try {
    const codes = getActiveGiftCodesForUser(auth.user.userId);
    return NextResponse.json({
      codes: codes.map((c) => ({
        format: c.format_locked,
        remainingUses: c.uses_remaining,
      })),
    });
  } catch (err) {
    logger.error(
      { route: "/api/gift-codes/my-codes", method: "GET", userId: auth.user.userId, err },
      "My gift codes DB error"
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
