// app/app/api/join/[token]/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getInviteCode, createVerificationCode } from "@/lib/db/queries";
import { sendVerificationCode } from "@/lib/email/resend";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

// 3 verification emails per IP per minute
const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 3 });

function generateVerificationCode(): string {
  const bytes = randomBytes(3);
  const num = ((bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) % 1000000;
  return num.toString().padStart(6, "0");
}

function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  const redactedLocal = local[0] + "***" + (local.length > 1 ? local[local.length - 1] : "");
  const domainParts = domain.split(".");
  const redactedDomain = domainParts[0][0] + "***" + "." + domainParts.slice(1).join(".");
  return `${redactedLocal}@${redactedDomain}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const { token } = await params;
    const invite = getInviteCode(token);
    if (!invite || !invite.is_active || invite.used_by !== null) {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    // createVerificationCode now invalidates prior codes in a transaction
    createVerificationCode(invite.id, invite.invitee_email, code, expiresAt);

    await sendVerificationCode({ to: invite.invitee_email, code });

    return NextResponse.json({
      success: true,
      redactedEmail: redactEmail(invite.invitee_email),
    });
  } catch (err) {
    console.error("[POST /api/join/[token]/verify]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
