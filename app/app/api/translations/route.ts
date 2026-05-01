import { requireAuth } from '@/lib/auth/middleware';
import { getAvailableTranslations } from '@/lib/translations/registry';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;
    void user;
    // Return translations as 'uncached' — the page loader does the real cache probe.
    // The registry only changes when env config changes, so a private 5-minute cache
    // covers route-handler hot-reload without sticking stale state across deploys.
    return Response.json(
      {
        translations: getAvailableTranslations().map((t) => ({
          id: t.id,
          name: t.name,
          state: 'uncached' as const,
        })),
      },
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    );
  } catch (err) {
    logger.error({ route: '/api/translations', err }, 'Translations list failed');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
