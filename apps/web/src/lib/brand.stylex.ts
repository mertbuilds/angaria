import { defineConsts } from '@stylexjs/stylex';

/**
 * The site's blue (src/brand.css). Use it sparingly: buttons, the selected
 * plan, markers, link hovers. Everything else stays black and white.
 */
export const brand = defineConsts({
  fill: 'var(--brand)',
  ink: 'var(--brand-ink)',
  shotShadow: 'var(--shot-shadow)',
  tint: 'var(--brand-tint)',
});

/** The site's motion: a slow rise for reveals, the canon's ease-out for everything. */
export const reveal = defineConsts({
  distance: '16px',
  duration: '700ms',
  ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
  stagger: '80ms',
});

/**
 * Where hidden-until-revealed styles apply: only for people who have not asked
 * for less motion, and only with scripting on, so a page without JavaScript
 * (or a crawler that does not run it) still shows everything.
 */
export const media = defineConsts({
  motionOk: '@media (prefers-reduced-motion: no-preference) and (scripting: enabled)',
});
