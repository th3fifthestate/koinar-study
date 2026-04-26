// app/components/layout/footer.tsx
import Link from 'next/link';

const LINK_CLASS =
  'block font-display text-[1.1rem] font-normal text-[var(--stone-200)] hover:text-[var(--warmth)] transition-colors py-1.5 focus-visible:outline-2 focus-visible:outline-[var(--sage-500)] focus-visible:outline-offset-2 rounded-sm';

const COL_TITLE_CLASS =
  "font-sans text-[10px] font-medium uppercase tracking-[0.32em] text-[var(--stone-500)] mb-6";

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function getDayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
  return Math.floor(diff / 86400000);
}

export function Footer() {
  const now = new Date();
  const year = now.getFullYear();
  const dayOfYear = getDayOfYear(now);
  const monthDay = `${MONTHS[now.getMonth()]} ${now.getDate()}, ${year}`;

  return (
    <footer className="bg-[var(--stone-900)] text-[var(--stone-200)] px-14 pt-24 pb-9">
      <div className="mx-auto max-w-[1280px] mb-16 grid gap-12 md:gap-24 grid-cols-1 md:[grid-template-columns:1.4fr_1fr_1fr]">
        <div>
          <div
            className="font-display font-medium uppercase text-[var(--stone-50)] mb-[18px]"
            style={{
              fontSize: '22px',
              letterSpacing: '0.42em',
              paddingLeft: '0.42em',
              fontVariationSettings: '"opsz" 144',
            }}
          >
            KOINAR
          </div>
          <p
            className="font-display italic font-normal text-[var(--stone-300)] m-0"
            style={{ fontSize: '1.1rem', lineHeight: 1.55, maxWidth: '280px' }}
          >
            A quiet fellowship reading Scripture together.
          </p>
        </div>

        <nav aria-label="Explore">
          <h4 className={COL_TITLE_CLASS}>Explore</h4>
          <ul>
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
            <li>
              <Link href="/privacy" className={LINK_CLASS}>
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className={LINK_CLASS}>
                Terms
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Account">
          <h4 className={COL_TITLE_CLASS}>Account</h4>
          <ul>
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

      <div
        className="mx-auto max-w-[1280px] flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center pt-6 font-sans text-[10px] uppercase text-[var(--stone-500)]"
        style={{
          letterSpacing: '0.24em',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <span>&copy; {year} Koinar</span>
        <span>
          Issue No. {dayOfYear} &mdash; {monthDay}
        </span>
      </div>
    </footer>
  );
}
