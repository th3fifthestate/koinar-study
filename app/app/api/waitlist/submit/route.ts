// app/app/api/waitlist/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createWaitlistEntry, getWaitlistByEmail } from "@/lib/db/queries";

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  message: z.string().min(10).max(500),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { name, email, message } = parsed.data;

    const existing = getWaitlistByEmail(email);
    if (existing) {
      // Don't reveal whether email is on waitlist — return success anyway
      return NextResponse.json({
        success: true,
        message: "Your request has been submitted. We'll be in touch!",
      });
    }

    createWaitlistEntry({ email, name, message });

    return NextResponse.json({
      success: true,
      message: "Your request has been submitted. We'll be in touch!",
    });
  } catch (err) {
    console.error("[POST /api/waitlist/submit]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
