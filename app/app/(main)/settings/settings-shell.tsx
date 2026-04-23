'use client';

import Link from 'next/link';
import { useRef } from 'react';
import type { SessionData } from '@/lib/auth/session';
import type { UserSettings, InviteRow } from '@/lib/db/types';
import { ProfileTab } from './tabs/profile-tab';
import { AccountTab } from './tabs/account-tab';
import { ApiKeyTab } from './tabs/api-key-tab';
import { InvitationsTab } from './tabs/invitations-tab';
import { AdminTab } from './tabs/admin-tab';

type TabId = 'profile' | 'account' | 'api-key' | 'invitations' | 'admin';
interface Tab { id: TabId; label: string; }

const BASE_TABS: Tab[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'account', label: 'Account' },
  { id: 'api-key', label: 'API Key' },
  { id: 'invitations', label: 'Invitations' },
];

interface Props {
  user: SessionData;
  settings: UserSettings;
  invitations: InviteRow[];
  invitesRemaining: number | null;
  studyOptions: { id: number; title: string }[];
  initialTab: string;
}

export function SettingsShell({
  user,
  settings,
  invitations,
  invitesRemaining,
  studyOptions,
  initialTab,
}: Props) {
  const tabs = user.isAdmin
    ? [...BASE_TABS, { id: 'admin' as TabId, label: 'Admin' }]
    : BASE_TABS;
  const activeTab = (tabs.find(t => t.id === initialTab)?.id ?? 'profile') as TabId;
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = tabs.length - 1;
    }
    if (next !== null) {
      e.preventDefault();
      tabRefs.current[next]?.focus();
      tabRefs.current[next]?.click();
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <Link
          href="/"
          className="inline-block font-body text-sm text-stone-500 hover:text-stone-700 transition-colors mb-6"
        >
          ← Back to Library
        </Link>
        <h1 className="font-display text-3xl md:text-4xl font-normal text-stone-900 mb-10">
          Settings
        </h1>
        <div className="md:flex md:gap-12">
          {/* Tab nav — left-rail on desktop, horizontal pills on mobile */}
          <nav
            role="tablist"
            aria-label="Settings sections"
            className="flex md:flex-col gap-1 md:gap-0 md:w-44 mb-8 md:mb-0 flex-shrink-0 overflow-x-auto md:overflow-visible"
          >
            {tabs.map((tab, i) => (
              <Link
                key={tab.id}
                ref={el => { tabRefs.current[i] = el; }}
                role="tab"
                href={`/settings?tab=${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                onKeyDown={e => handleKeyDown(e, i)}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className={[
                  'font-body text-base text-left px-3 py-2 transition-colors whitespace-nowrap',
                  'md:border-l-2',
                  activeTab === tab.id
                    ? 'md:border-sage-500 text-stone-900 font-medium underline md:no-underline underline-offset-2'
                    : 'md:border-transparent text-stone-500 hover:text-stone-700',
                ].join(' ')}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          {/* Active tab panel */}
          <div className="flex-1 min-w-0">
            <div
              role="tabpanel"
              id={`panel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
            >
              {activeTab === 'profile' && <ProfileTab settings={settings} />}
              {activeTab === 'account' && <AccountTab settings={settings} />}
              {activeTab === 'api-key' && <ApiKeyTab settings={settings} />}
              {activeTab === 'invitations' && (
                <InvitationsTab
                  invitations={invitations}
                  invitesRemaining={invitesRemaining}
                  studyOptions={studyOptions}
                />
              )}
              {activeTab === 'admin' && user.isAdmin && <AdminTab />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
