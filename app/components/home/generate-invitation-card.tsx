import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function GenerateInvitationCard() {
  return (
    <div className="h-full flex flex-col justify-between p-7 border border-transparent bg-[var(--stone-50)] transition-all duration-500 group hover:border-[var(--stone-200)] hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(44,41,36,0.06)]"
      style={{ minHeight: '280px', background: 'color-mix(in srgb, var(--warmth) 4%, var(--stone-50))' }}
    >
      <div>
        {/* Eyebrow divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-6 h-px bg-[var(--sage-500)]" />
          <span className="text-[9px] uppercase tracking-[0.25em] text-[var(--sage-500)]">
            Workbench
          </span>
        </div>

        {/* Headline */}
        <h3
          className="font-display font-normal leading-[1.15] text-[var(--stone-900)] mb-3"
          style={{ fontSize: '1.75rem' }}
        >
          <em>Begin a study.</em>
        </h3>

        {/* Subline */}
        <p className="font-body text-[1rem] leading-relaxed text-[var(--stone-300)]">
          Write the next reading in the library.
        </p>
      </div>

      {/* Link */}
      <Link
        href="/generate"
        className="flex items-center gap-2.5 mt-6 group/link"
        aria-label="Open the workbench to begin a study"
      >
        <div className="w-[30px] h-[30px] rounded-full border border-[var(--stone-200)] flex items-center justify-center text-[var(--stone-700)] transition-all duration-400 group-hover/link:bg-[var(--stone-900)] group-hover/link:text-[var(--stone-50)] group-hover/link:border-[var(--stone-900)]">
          <ArrowUpRight className="h-3 w-3" />
        </div>
        <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--stone-300)] opacity-0 -translate-x-2 transition-all duration-400 group-hover/link:opacity-100 group-hover/link:translate-x-0">
          Open the workbench
        </span>
      </Link>
    </div>
  );
}
