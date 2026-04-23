import type { Quote } from '@/lib/home/quote-rotation';

interface EditorialAsideProps {
  quote: Quote;
}

export function EditorialAside({ quote }: EditorialAsideProps) {
  return (
    <section
      className="py-24 md:py-32 px-6 bg-[var(--stone-50)] dark:bg-[var(--stone-900)]"
      aria-label="Editorial aside"
    >
      <div className="mx-auto max-w-[720px] flex flex-col items-center text-center">
        {/* Top sage divider */}
        <div className="w-[60%] h-px bg-[var(--sage-300)] mb-12" aria-hidden="true" />

        {/* Quote */}
        <blockquote>
          <p
            className="font-display font-normal leading-[1.35] text-[var(--stone-700)] dark:text-[var(--stone-100)] mb-6"
            style={{ fontSize: 'clamp(1.375rem, 3vw, 2rem)' }}
          >
            <em>&#8220;{quote.body}&#8221;</em>
          </p>
          <footer>
            <cite
              className="font-body text-[0.875rem] uppercase tracking-[0.18em] not-italic"
              style={{ color: 'var(--warmth)' }}
            >
              {quote.attribution}
            </cite>
          </footer>
        </blockquote>

        {/* Bottom sage divider */}
        <div className="w-[60%] h-px bg-[var(--sage-300)] mt-12 mb-10" aria-hidden="true" />

        {/* Subline */}
        <p className="font-body text-[1rem] leading-relaxed text-[var(--stone-300)] italic">
          The library grows slowly. Read what the hour suggests.
        </p>
      </div>
    </section>
  );
}
