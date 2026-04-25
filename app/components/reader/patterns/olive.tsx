// app/components/reader/patterns/olive.tsx
'use client';

import { type CSSProperties } from 'react';

interface OlivePatternProps {
  /** Mode determines stroke color and opacity. */
  mode: 'light' | 'dark';
  /** Optional opacity override; defaults are 0.25 (light) / 0.18 (dark). */
  opacity?: number;
}

/**
 * Decorative olive-branch SVG pattern, tiled at 180px. Used on the hero
 * and selected section beds to add organic warmth without overpowering
 * the typographic system.
 *
 * Stroke color is sage-700 (light) or warmth (dark). Opacity defaults
 * are spec §5; override with the `opacity` prop if a denser or lighter
 * tone is wanted on a specific bed.
 *
 * Note: SVG-as-data-URL can't reference CSS custom properties, so the
 * stroke colors are hardcoded as URL-encoded hex values matching the
 * sage-700 (#3d4f35) and warmth (#c49a6c) tokens. If those tokens are
 * retuned in globals.css, this component must be updated in lockstep.
 */
export function OlivePattern({ mode, opacity }: OlivePatternProps) {
  const strokeColor = mode === 'dark' ? '%23c49a6c' : '%233d4f35';
  const defaultOpacity = mode === 'dark' ? 0.18 : 0.25;

  const svg =
    `data:image/svg+xml;utf8,` +
    `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'>` +
    `<g fill='none' stroke='${strokeColor}' stroke-width='0.7' stroke-linecap='round' opacity='0.55'>` +
    `<path d='M30 38 q22 -8 44 6'/>` +
    `<ellipse cx='34' cy='34' rx='2.4' ry='5.5' transform='rotate(-32 34 34)'/>` +
    `<ellipse cx='44' cy='32' rx='2.4' ry='5.5' transform='rotate(-12 44 32)'/>` +
    `<ellipse cx='56' cy='34' rx='2.4' ry='5.5' transform='rotate(14 56 34)'/>` +
    `<ellipse cx='66' cy='38' rx='2.4' ry='5.5' transform='rotate(34 66 38)'/>` +
    `<path d='M104 122 q22 -8 44 6'/>` +
    `<ellipse cx='108' cy='118' rx='2.4' ry='5.5' transform='rotate(-32 108 118)'/>` +
    `<ellipse cx='118' cy='116' rx='2.4' ry='5.5' transform='rotate(-12 118 116)'/>` +
    `<ellipse cx='130' cy='118' rx='2.4' ry='5.5' transform='rotate(14 130 118)'/>` +
    `<ellipse cx='140' cy='122' rx='2.4' ry='5.5' transform='rotate(34 140 122)'/>` +
    `</g></svg>`;

  const style: CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundImage: `url("${svg}")`,
    backgroundSize: '180px 180px',
    backgroundRepeat: 'repeat',
    pointerEvents: 'none',
    opacity: opacity ?? defaultOpacity,
    zIndex: 0,
  };

  return <div aria-hidden="true" style={style} />;
}
