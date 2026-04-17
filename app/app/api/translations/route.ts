import { requireAuth } from '@/lib/auth/middleware';
import { getAvailableTranslations } from '@/lib/translations/registry';

export async function GET() {
  const { user, response } = await requireAuth();
  if (response) return response;
  void user;
  return Response.json({ translations: getAvailableTranslations() });
}
