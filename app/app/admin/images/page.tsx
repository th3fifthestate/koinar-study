import { requireAdminPage } from '@/lib/auth/middleware';
import ImagesClient from './images-client';

// Server-side admin gate. Layered on top of app/admin/layout.tsx so a
// refactor that removes or restructures the layout can't silently expose
// this page to non-admins.
export default async function ImagesPage() {
  await requireAdminPage();
  return <ImagesClient />;
}
