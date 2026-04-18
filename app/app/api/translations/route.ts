import { requireAuth } from '@/lib/auth/middleware';
import { getAvailableTranslations } from '@/lib/translations/registry';

export async function GET() {
  const { user, response } = await requireAuth();
  if (response) return response;
  void user;
  // Return translations as 'uncached' — the page loader does the real cache probe
  return Response.json({
    translations: getAvailableTranslations().map((t) => ({
      id: t.id,
      name: t.name,
      state: 'uncached' as const,
    })),
  });
}
