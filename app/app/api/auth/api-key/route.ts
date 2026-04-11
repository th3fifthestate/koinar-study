import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { encryptApiKey } from "@/lib/ai/keys";
import { getDb } from "@/lib/db/connection";
import { z } from "zod";

const setKeySchema = z.object({
  apiKey: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

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
}

export async function DELETE() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  getDb()
    .prepare("UPDATE users SET api_key_encrypted = NULL WHERE id = ?")
    .run(auth.user.userId);

  return NextResponse.json({ success: true });
}
