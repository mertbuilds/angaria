import { defineConsts } from '@stylexjs/stylex';

/**
 * Design tokens for the component set (src/ui).
 *
 * Each token wraps a CSS custom property defined in `src/theme.css`. Theming
 * is driven by those variables (light on `:root`, dark via
 * `prefers-color-scheme` or `data-theme`), so components reference
 * `colors.primary` / `radius.md` instead of stringly-typed `var(--primary)`.
 *
 * App-level layout tokens (spacing, font, motion, raw palette) live in
 * `src/tokens.stylex.ts`; this file is component-internal. Components take
 * `motion` from there.
 */
export const colors = defineConsts({
  accent: 'var(--accent)',
  accentForeground: 'var(--accent-foreground)',
  background: 'var(--background)',
  border: 'var(--border)',
  card: 'var(--card)',
  cardForeground: 'var(--card-foreground)',
  destructive: 'var(--destructive)',
  foreground: 'var(--foreground)',
  input: 'var(--input)',
  muted: 'var(--muted)',
  mutedForeground: 'var(--muted-foreground)',
  popover: 'var(--popover)',
  popoverForeground: 'var(--popover-foreground)',
  primary: 'var(--primary)',
  primaryForeground: 'var(--primary-foreground)',
  ring: 'var(--ring)',
  secondary: 'var(--secondary)',
  secondaryForeground: 'var(--secondary-foreground)',
  sidebar: 'var(--sidebar)',
  sidebarAccent: 'var(--sidebar-accent)',
  sidebarAccentForeground: 'var(--sidebar-accent-foreground)',
  sidebarBorder: 'var(--sidebar-border)',
  sidebarForeground: 'var(--sidebar-foreground)',
  sidebarPrimary: 'var(--sidebar-primary)',
  sidebarPrimaryForeground: 'var(--sidebar-primary-foreground)',
  sidebarRing: 'var(--sidebar-ring)',
  warning: 'var(--warning)',
});

/**
 * Optional theme variables. theme.css leaves them unset, so each falls back to
 * the look the kit ships; an app's palette sets them to tune one part without
 * changing what the shared variables mean.
 */
export const optional = defineConsts({
  /** Fill of text fields and select triggers. */
  inputBackground: 'var(--input-background, transparent)',
  /** A field's border under the pointer: a step stronger than `--input`. */
  inputHover: 'var(--input-hover, color-mix(in oklab, var(--input) 80%, var(--foreground)))',
  /** The primary color as text: the link button. */
  primaryInk: 'var(--primary-ink, var(--primary))',
  switchThumb: 'var(--switch-thumb, var(--background))',
  /** The chosen tab of a segmented control: fill, text and 1px edge. */
  tabActive: 'var(--tab-active, var(--background))',
  tabActiveEdge: 'var(--tab-active-edge, var(--border))',
  tabActiveForeground: 'var(--tab-active-foreground, var(--foreground))',
  tooltip: 'var(--tooltip, var(--primary))',
  tooltipForeground: 'var(--tooltip-foreground, var(--primary-foreground))',
});

/**
 * Radius scale, pinned: surfaces (cards/dialogs/popovers) use 8px
 * (`--radius: 8px`); controls (buttons/inputs/select triggers) use `full`
 * (pill). sm through 2xl all resolve to the surface radius so registry
 * components render 8px corners regardless of which step they reference;
 * only pill shapes (`full`) diverge.
 */
export const radius = defineConsts({
  '2xl': 'var(--radius)',
  full: '9999px',
  lg: 'var(--radius)',
  md: 'var(--radius)',
  sm: 'var(--radius)',
  xl: 'var(--radius)',
});
