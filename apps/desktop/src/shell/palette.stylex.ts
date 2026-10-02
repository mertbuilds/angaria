import { defineConsts } from '@stylexjs/stylex';

/**
 * The palette's own variables (src/palettes.css) for the desktop's StyleX
 * styles, next to `colors` from @angaria/ui. Regions part by these tones, not
 * by borders: cards on the canvas, a selection fill for the chosen row.
 */
export const tones = defineConsts({
  card: 'var(--card)',
  divider: 'var(--divider)',
  ink: 'var(--primary-ink)',
  navActive: 'var(--nav-active)',
  navActiveForeground: 'var(--nav-active-foreground)',
  navActiveIcon: 'var(--nav-active-icon)',
  paperEdge: 'var(--paper-edge)',
  paperFilter: 'var(--paper-filter)',
  ring: 'var(--ring)',
  selection: 'var(--selection)',
  selectionForeground: 'var(--selection-foreground)',
  shellInset: 'var(--shell-inset)',
  shellRadius: 'var(--shell-radius)',
  sidebar: 'var(--sidebar)',
  tabActive: 'var(--tab-active)',
  tabActiveForeground: 'var(--tab-active-foreground)',
});
