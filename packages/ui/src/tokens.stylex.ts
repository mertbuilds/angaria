import { defineConsts, defineVars } from '@stylexjs/stylex';

/**
 * Raw palette. Black, white, and the canon grays. Do not use these directly in
 * components: use the semantic `colors` below so dark mode keeps working.
 * Literal values on purpose: these must not flip with the color scheme.
 */
export const palette = defineVars({
  black: '#000000',
  gray100: '#f5f5f5',
  gray300: '#d4d4d4',
  gray500: '#8a8a8a',
  gray700: '#3f3f3f',
  gray900: '#1a1a1a',
  white: '#ffffff',
});

/**
 * Semantic colors. Each wraps a CSS custom property defined in `src/theme.css`:
 * the theme is switched by a `data-theme` attribute on `<html>` (absent =
 * follow the system), which StyleX variables cannot key on.
 */
export const colors = defineConsts({
  bg: 'var(--background)',
  border: 'var(--border)',
  disabled: 'var(--muted-foreground)',
  error: 'var(--destructive)',
  fg: 'var(--foreground)',
  muted: 'var(--muted-foreground)',
  subtle: 'var(--muted)',
  warning: 'var(--warning)',
});

/** Surface radius (cards, dialogs, popovers) and the pill for controls. */
export const radius = defineConsts({
  base: 'var(--radius)',
  full: '9999px',
});

/** 4px spacing grid. */
export const spacing = defineVars({
  s1: '4px',
  s12: '48px',
  s16: '64px',
  s2: '8px',
  s3: '12px',
  s4: '16px',
  s6: '24px',
  s8: '32px',
});

/** Suisse Intl in two weights only: 400 and 500. Headings use 500, never bold. */
export const font = defineVars({
  family: 'var(--font-sans)',
  sizeLg: '20px',
  sizeMd: '16px',
  sizeSm: '14px',
  sizeXs: '12px',
  weightMedium: '500',
  weightRegular: '400',
});

/** 200ms fade, 260ms ease-out for movement. Drop both under reduced motion. */
export const motion = defineConsts({
  ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
  fade: '200ms',
  move: '260ms',
});
