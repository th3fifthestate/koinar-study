import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { encryptApiKey } from "@/lib/ai/keys";
import { getDb } from "@/lib/db/connection";
import { z } from "zod";

const setKeySchema = z.object({
  apiKey: z.string().min(1),
});

// Simple in-memory rate limiter: 5 requests per 60 seconds per user
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string | number): boolean {
  const userIdStr = String(userId);
  const now = Date.now();
  const record = requestCounts.get(userIdStr);

  if (!record || now > record.resetAt) {
    // Reset window
    requestCounts.set(userIdStr, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (record.count < 5) {
    record.count++;
    return true;
  }

  return false;
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;

    // Rate limiting: 5 requests per 60 seconds
    if (!checkRateLimit(auth.user.userId)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 5 requests per 60 seconds." },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = setKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "apiKey field required" }, { status: 400 });
    }

    if (!parsed.data.apiKey.startsWith("sk-ant-")) {
      return NextResponse.json(
        { error: "Invalid API key format. Anthropic keys start with 'sk-ant-'" },
        { status: 400 }
      );
    }

    const encrypted = encryptApiKey(parsed.data.apiKey);
    getDb()
      .prepare("UPDATE users SET api_key_encrypted = ? WHERE id = ?")
      .run(encrypted, auth.user.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/auth/api-key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;

    // Rate limiting: 5 requests per 60 seconds
    if (!checkRateLimit(auth.user.userId)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 5 requests per 60 seconds." },
        { status: 429 }
      );
    }

    getDb()
      .prepare("UPDATE users SET api_key_encrypted = NULL WHERE id = ?")
      .run(auth.user.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/auth/api-key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
