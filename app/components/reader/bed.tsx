// app/components/reader/bed.tsx
'use client';

import { type ReactNode, useContext, createContext } from 'react';
import { OlivePattern } from './patterns/olive';
import { SectionHeader } from './section-header';

export type BedVariant = 'cream' | 'warm' | 'sage' | 'ink';

interface BedProps {
  variant: BedVariant;
  /** When 'olive', overlays the olive-branch SVG pattern. */
  pattern?: 'olive';
  /** Heading rendered via SectionHeader. */
  heading?: ReactNode;
  /** Optional intro shown in the right column of SectionHeader. */
  intro?: ReactNode;
  /** Body content — flows in the centered 880px reading column. */
  children: ReactNode;
  /** Optional anchor id for in-page navigation. */
  id?: string;
  /** Forwarded data attribute used by useActiveHeading. */
  'data-section-key'?: string;
}

const BED_BG: Record<BedVariant, string> = {
  cream: 'var(--bed-cream)',
  warm: 'var(--bed-warm)',
  sage: 'var(--bed-sage)',
  ink: 'var(--bed-ink)',
};

/**
 * Provides the current bed variant to descendants. Useful for any child
 * component that needs to adapt its styling based on whether it's sitting
 * on a light surface (cream/warm/sage) or a dark surface (ink). Default
 * 'cream' means "no bed" — used outside the bed subtree.
 */
const BedVariantContext = createContext<BedVariant>('cream');

export function useBedVariant(): BedVariant {
  return useContext(BedVariantContext);
}

/**
 * Full-bleed section bed. Layout: pattern overlay (optional) →
 * SectionHeader (optional) → reading column body (max-width 880px,
 * centered).
 *
 * Spec: §3 (palette per mode), §4 (layout), §5 (atmosphere).
 */
export function Bed({
  variant,
  pattern,
  heading,
  intro,
  children,
  id,
  'data-section-key': dataKey,
}: BedProps) {
  return (
    <BedVariantContext.Provider value={variant}>
      <section
        id={id}
        data-section-key={dataKey}
        data-bed={variant}
        className="relative w-full"
        style={{
          background: BED_BG[variant],
          padding: '144px 64px 160px',
        }}
      >
        {pattern === 'olive' && <BedOliveOverlay variant={variant} />}
        <div className="relative z-[1]">
          {heading && <SectionHeader heading={heading} intro={intro} />}
          <div className="mx-auto max-w-[880px]">{children}</div>
        </div>
      </section>
    </BedVariantContext.Provider>
  );
}

/**
 * Internal helper: chooses the right olive stroke based on the bed
 * variant. Light surfaces (cream/warm/sage) get the sage stroke; the
 * dark `ink` bed gets the warmth stroke. The OlivePattern component's
 * `mode` prop controls stroke color and default opacity.
 */
function BedOliveOverlay({ variant }: { variant: BedVariant }) {
  const isDarkSurface = variant === 'ink';
  return <OlivePattern mode={isDarkSurface ? 'dark' : 'light'} />;
}
