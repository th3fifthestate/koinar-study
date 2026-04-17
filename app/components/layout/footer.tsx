// app/components/layout/footer.tsx
import Link from 'next/link';

const LINK_CLASS =
  'text-base text-[var(--stone-50)]/60 hover:text-[var(--stone-50)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--sage-500)] focus-visible:outline-offset-2 rounded';

export function Footer() {
  return (
    <footer className="bg-[var(--stone-900)] text-[var(--stone-50)] px-10 pt-16 pb-10">
      <div className="mx-auto max-w-[1280px] grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-20">
        <div>
          <div className="font-display text-2xl font-medium tracking-wide mb-3">KOINAR</div>
          <p className="text-base leading-relaxed text-[var(--stone-50)]/35 max-w-[280px]">
            A quiet fellowship reading Scripture together.
          </p>
        </div>

        <nav aria-label="Explore">
          <h4 className="text-[10px] uppercase tracking-[0.25em] text-[var(--stone-50)]/35 mb-5">
            Explore
          </h4>
          <ul className="space-y-3">
            <li>
              <Link href="/about" className={LINK_CLASS}>
                About Koinar
              </Link>
            </li>
            <li>
              <Link href="/attributions" className={LINK_CLASS}>
                Attributions
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Account">
          <h4 className="text-[10px] uppercase tracking-[0.25em] text-[var(--stone-50)]/35 mb-5">
            Account
          </h4>
          <ul className="space-y-3">
            <li>
              <Link href="/settings" className={LINK_CLASS}>
                Settings
              </Link>
            </li>
            <li>
              <Link href="/generate" className={LINK_CLASS}>
                New Study
              </Link>
            </li>
            <li>
              <Link href="/contact" className={LINK_CLASS}>
                Contact
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="mx-auto max-w-[1280px] mt-12 pt-8 border-t border-[var(--stone-50)]/[0.08]">
        <span className="text-xs text-[var(--stone-50)]/20">
          &copy; {new Date().getFullYear()} Koinar. Read with others.
        </span>
      </div>
    </footer>
  );
}
