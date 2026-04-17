import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { encryptApiKey } from '@/lib/ai/keys';
import { setUserApiKey, clearUserApiKey } from '@/lib/db/queries';
import { createRateLimiter } from '@/lib/rate-limit';
import { z } from 'zod';

// Shared bucket: PATCH + DELETE are both key-state mutations
const limiter = createRateLimiter({ windowMs: 10 * 60_000, max: 3 });

const setKeySchema = z.object({
  apiKey: z.string().min(1),
});

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (limiter(`user-${auth.user.userId}`)) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in 10 minutes.' },
      { status: 429, headers: { 'Retry-After': '600' } }
    );
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = setKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'apiKey field required' }, { status: 400 });
  }

  if (!parsed.data.apiKey.startsWith('sk-ant-')) {
    return NextResponse.json(
      { error: "Invalid API key format. Anthropic keys start with 'sk-ant-'" },
      { status: 400 }
    );
  }

  // Extract tail from plaintext BEFORE encryption — never from ciphertext
  const tail = parsed.data.apiKey.slice(-4);

  try {
    const encrypted = encryptApiKey(parsed.data.apiKey);
    setUserApiKey(auth.user.userId, encrypted, tail);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  console.info(`[security] api key updated for userId=${auth.user.userId}`);
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (limiter(`user-${auth.user.userId}`)) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in 10 minutes.' },
      { status: 429, headers: { 'Retry-After': '600' } }
    );
  }

  try {
    clearUserApiKey(auth.user.userId);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  console.info(`[security] api key cleared for userId=${auth.user.userId}`);
  return NextResponse.json({ success: true });
}
