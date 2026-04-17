import { getCurrentUser } from "@/lib/auth/session";
import { AboutGuest } from "./about-guest";
import { AboutMember } from "./about-member";

// Search crawlers visit unauthenticated; guest metadata serves SEO.
// Member-specific title is omitted intentionally — static optimization
// cannot vary metadata per session without disabling the page cache.
export const metadata = {
  title: "About \u2014 Koinar",
  description: "A quiet fellowship reading Scripture together. By invitation.",
};

export default async function AboutPage() {
  const user = await getCurrentUser();
  if (user) return <AboutMember />;
  return <AboutGuest />;
}
