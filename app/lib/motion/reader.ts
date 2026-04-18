/**
 * Motion vocabulary for reader UI interactions.
 *
 * Each primitive is defined with explicit duration and easing values.
 * CSS transition string helpers are exported for direct use in style props.
 * Future reader code (brief 28c+) imports from here rather than redefining values inline.
 *
 * General motion rules (from UI-GUIDELINES.md):
 * - Never use `linear` for UI motion
 * - `ease-out` for entrances
 * - `ease-in-out` for transitions between steady states
 * - 150–300ms for micro interactions
 * - 300–500ms for transitions between states
 * - 500–800ms for page-level transitions
 */

/**
 * Base shape for all motion primitives.
 */
export interface MotionSpec {
  duration: number; // milliseconds
  easing: string;   // CSS easing function or cubic-bezier
}

/* ─────────────────────────────────────────────────────────────────────────
   HERO & SURFACE TRANSITIONS
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Hero mood shift: CSS variable swap on ReaderSurface background.
 * Fires on mount only; no live time-of-day transitions during session.
 * Duration: 1200ms for smooth, leisurely mood establishment.
 */
export const READER_MOTION_HERO_MOOD: MotionSpec = {
  duration: 1200,
  easing: 'ease-in-out',
};

/* ─────────────────────────────────────────────────────────────────────────
   POPOVER INTERACTIONS
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Popover enter: scale-in, opacity fade, upward slide.
 * Combines:
 *   - opacity: 0 → 1
 *   - transform: translateY(4px) + scale(0.97 → 1)
 * Easing: Ease Out Quart (cubic-bezier(0.2, 0.8, 0.2, 1))
 * Duration: 160ms for snappy entrance.
 */
export const READER_MOTION_POPOVER_ENTER: MotionSpec = {
  duration: 160,
  easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
};

/**
 * Popover exit: reverse of enter, faster for quick dismissal.
 * Combines:
 *   - opacity: 1 → 0
 *   - transform: translateY(-4px) + scale(1 → 0.97)
 * Duration: 120ms (faster than enter, maintains visual feedback).
 */
export const READER_MOTION_POPOVER_EXIT: MotionSpec = {
  duration: 120,
  easing: 'ease-out',
};

/**
 * Popover drag-snap: max-height animation on pointer release.
 * Snaps to default or max height if released within 24px threshold.
 * Duration: 120ms for crisp snap feedback.
 */
export const READER_MOTION_POPOVER_DRAG_SNAP: MotionSpec = {
  duration: 120,
  easing: 'ease-out',
};

/**
 * Popover drag-reset: max-height animation on double-click handle.
 * Smoother than snap; allows deliberate reset.
 * Duration: 180ms for controlled return to default state.
 */
export const READER_MOTION_POPOVER_DRAG_RESET: MotionSpec = {
  duration: 180,
  easing: 'ease-out',
};

/* ─────────────────────────────────────────────────────────────────────────
   TABLE OF CONTENTS (TOC) GLIDER
   ───────────────────────────────────────────────────────────────────────── */

/**
 * TOC glide: translateY animation of single indicator element.
 * Moves the glider bar between section dots as user scrolls.
 * Not per-dot swap; smooth continuous motion.
 * Duration: 180ms for smooth tracking feel.
 */
export const READER_MOTION_TOC_GLIDE: MotionSpec = {
  duration: 180,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
};

/**
 * TOC glider fade-in: opacity animation on first mount.
 * Reveals the glider element after initial position is set (no transition).
 * Adds visual polish without disorienting jumps.
 * Duration: 240ms for gentle reveal.
 */
export const READER_MOTION_TOC_GLIDER_FADE_IN: MotionSpec = {
  duration: 240,
  easing: 'ease-out',
};

/* ─────────────────────────────────────────────────────────────────────────
   FONT SIZE ADJUSTMENTS
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Font-size apply: applies when user changes size in popover.
 * Smoothly transitions prose root font-size to new value.
 * Duration: 200ms for perceived instant but smooth change.
 */
export const READER_MOTION_FONT_SIZE_APPLY: MotionSpec = {
  duration: 200,
  easing: 'ease-out',
};

/* ─────────────────────────────────────────────────────────────────────────
   CSS TRANSITION STRING HELPERS
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Ready-to-use CSS transition string for popover enter.
 * Drop directly into style prop or Tailwind `[transition:...]`.
 * Animates opacity and transform together.
 */
export const READER_TRANSITION_POPOVER_ENTER = `opacity ${READER_MOTION_POPOVER_ENTER.duration}ms ${READER_MOTION_POPOVER_ENTER.easing}, transform ${READER_MOTION_POPOVER_ENTER.duration}ms ${READER_MOTION_POPOVER_ENTER.easing}`;

/**
 * Ready-to-use CSS transition string for popover exit.
 * Mirror of enter but shorter duration.
 */
export const READER_TRANSITION_POPOVER_EXIT = `opacity ${READER_MOTION_POPOVER_EXIT.duration}ms ${READER_MOTION_POPOVER_EXIT.easing}, transform ${READER_MOTION_POPOVER_EXIT.duration}ms ${READER_MOTION_POPOVER_EXIT.easing}`;

/**
 * Ready-to-use CSS transition string for TOC glider translateY.
 * Animates the glider bar's vertical position.
 */
export const READER_TRANSITION_TOC_GLIDE = `transform ${READER_MOTION_TOC_GLIDE.duration}ms ${READER_MOTION_TOC_GLIDE.easing}`;

/**
 * Ready-to-use CSS transition string for TOC glider fade-in on first mount.
 * Animates opacity only; position is set without transition.
 */
export const READER_TRANSITION_TOC_FADEIN = `opacity ${READER_MOTION_TOC_GLIDER_FADE_IN.duration}ms ${READER_MOTION_TOC_GLIDER_FADE_IN.easing}`;

/**
 * Ready-to-use CSS transition string for font-size changes.
 * Applies to prose root when user adjusts text size in popover.
 */
export const READER_TRANSITION_FONT_SIZE = `font-size ${READER_MOTION_FONT_SIZE_APPLY.duration}ms ${READER_MOTION_FONT_SIZE_APPLY.easing}`;
