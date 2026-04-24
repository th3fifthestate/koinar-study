import { requireAdminPage } from '@/lib/auth/middleware';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

export const metadata = { title: 'Admin — Koinar' };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // requireAdminPage enforces sign-in + admin + 24h absolute admin session
  // TTL. Each page under this layout calls it again for defense in depth.
  await requireAdminPage();

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto bg-background p-6">
        {children}
      </main>
    </div>
  );
}
