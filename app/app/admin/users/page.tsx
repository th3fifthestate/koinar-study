import { requireAdminPage } from '@/lib/auth/middleware';
import UsersClient from './users-client';

// Server-side admin gate. Layered on top of app/admin/layout.tsx so a
// refactor that removes or restructures the layout can't silently expose
// this page to non-admins.
export default async function UsersPage() {
  await requireAdminPage();
  return <UsersClient />;
}
