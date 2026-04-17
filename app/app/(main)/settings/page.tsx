import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserSettings, listUserInvitations } from "@/lib/db/queries";
import { SettingsShell } from "./settings-shell";

export const metadata = { title: "Settings — Koinar" };

const VALID_TABS = ["profile", "account", "api-key", "invitations", "admin"] as const;
type TabId = typeof VALID_TABS[number];

function resolveTab(raw: string | undefined, isAdmin: boolean): TabId {
  const t = (raw ?? "profile") as TabId;
  if (!VALID_TABS.includes(t)) return "profile";
  if (t === "admin" && !isAdmin) return "profile";
  return t;
}

export default async function SettingsPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");
  if (!user.isApproved) redirect("/pending");

  const settings = getUserSettings(user.userId);
  if (!settings) redirect("/login");

  const invitations = listUserInvitations(user.userId);
  const sp = await props.searchParams;

  // Non-admin attempting ?tab=admin → silent redirect server-side (before shell sees it)
  if (sp.tab === "admin" && !user.isAdmin) {
    redirect("/settings?tab=profile");
  }

  const initialTab = resolveTab(sp.tab, user.isAdmin);

  return (
    <SettingsShell
      user={user}
      settings={settings}
      invitations={invitations}
      initialTab={initialTab}
    />
  );
}
