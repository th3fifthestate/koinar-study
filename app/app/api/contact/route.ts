import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { sendContactMessage } from "@/lib/email/resend";
import { getCurrentUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

// 3 submissions per IP per 5 minutes
const isRateLimited = createRateLimiter({ windowMs: 5 * 60_000, max: 3 });

const schema = z.object({
  topic: z.enum(["feedback", "bug", "factcheck"]),
  subject: z.string().min(5).max(140),
  message: z.string().min(20).max(4000),
  name: z.string().min(2).max(100),
  email: z.string().email().max(200),
  studyContext: z.string().max(500).optional(),
  honeypot: z.string().max(0, "spam detected").optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "300" } },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Honeypot check — belt-and-suspenders beyond schema's max(0)
    if (parsed.data.honeypot) {
      return NextResponse.json({ success: true });
    }

    const user = await getCurrentUser();

    await sendContactMessage({
      topic: parsed.data.topic,
      subject: parsed.data.subject,
      message: parsed.data.message,
      senderName: parsed.data.name,
      senderEmail: parsed.data.email,
      studyContext: parsed.data.studyContext ?? null,
      authenticatedUserId: user?.userId ?? null,
      authenticatedUsername: user?.username ?? null,
      ip,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ route: "/api/contact", err }, "Contact submission failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
