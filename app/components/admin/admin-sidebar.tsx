"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Clock,
  KeyRound,
  Gift,
  BookOpen,
  Image,
  BarChart3,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/waitlist', label: 'Waitlist', icon: Clock },
  { href: '/admin/invite-codes', label: 'Invite Codes', icon: KeyRound },
  { href: '/admin/gift-codes', label: 'Gift Codes', icon: Gift },
  { href: '/admin/studies', label: 'Studies', icon: BookOpen },
  { href: '/admin/images', label: 'Images', icon: Image },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r bg-card flex flex-col p-4">
      <div className="mb-6">
        <h2 className="text-base font-semibold">Admin Panel</h2>
        <p className="text-xs text-muted-foreground">Manage your community</p>
      </div>
      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="pt-4 border-t">
        <Link
          href="/settings"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Settings
        </Link>
      </div>
    </aside>
  );
}
