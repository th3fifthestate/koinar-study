import { requireAdminPage } from '@/lib/auth/middleware';
import GiftCodesClient from './gift-codes-client';

// Server-side admin gate. Layered on top of app/admin/layout.tsx so a
// refactor that removes or restructures the layout can't silently expose
// this page to non-admins.
export default async function GiftCodesPage() {
  await requireAdminPage();
  return <GiftCodesClient />;
}
