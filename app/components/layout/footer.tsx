// app/components/layout/footer.tsx
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-[var(--stone-900)] text-[var(--stone-50)] px-10 pt-16 pb-10">
      <div className="mx-auto max-w-[1280px] grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-20">
        <div>
          <div className="font-display text-2xl font-medium tracking-wide mb-3">KOINAR</div>
          <p className="text-sm leading-relaxed text-[var(--stone-50)]/35 max-w-[280px]">
            Bible studies crafted with contextual rigor — every verse in its full context.
          </p>
        </div>

        <nav>
          <h4 className="text-[10px] uppercase tracking-[0.25em] text-[var(--stone-50)]/35 mb-5">
            Explore
          </h4>
          <ul className="space-y-3">
            <li>
              <Link href="/about" className="text-sm text-[var(--stone-50)]/60 hover:text-[var(--stone-50)] transition-colors">
                About Koinar
              </Link>
            </li>
            <li>
              <Link href="/attributions" className="text-sm text-[var(--stone-50)]/60 hover:text-[var(--stone-50)] transition-colors">
                Attributions
              </Link>
            </li>
            <li>
              <Link href="/translations" className="text-sm text-[var(--stone-50)]/60 hover:text-[var(--stone-50)] transition-colors">
                Bible Translations
              </Link>
            </li>
          </ul>
        </nav>

        <nav>
          <h4 className="text-[10px] uppercase tracking-[0.25em] text-[var(--stone-50)]/35 mb-5">
            Account
          </h4>
          <ul className="space-y-3">
            <li>
              <Link href="/profile" className="text-sm text-[var(--stone-50)]/60 hover:text-[var(--stone-50)] transition-colors">
                Settings
              </Link>
            </li>
            <li>
              <Link href="/generate" className="text-sm text-[var(--stone-50)]/60 hover:text-[var(--stone-50)] transition-colors">
                New Study
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="mx-auto max-w-[1280px] flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mt-12 pt-8 border-t border-[var(--stone-50)]/[0.08]">
        <span className="text-xs text-[var(--stone-50)]/20">
          &copy; {new Date().getFullYear()} Koinar. All rights reserved.
        </span>
        <div className="flex gap-6">
          <Link href="/privacy" className="text-xs text-[var(--stone-50)]/20 hover:text-[var(--stone-50)]/50 transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="text-xs text-[var(--stone-50)]/20 hover:text-[var(--stone-50)]/50 transition-colors">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
