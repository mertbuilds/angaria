import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create } from '@stylexjs/stylex';

/**
 * Shared page styles. Every page is one 720px column; routes compose these
 * with the @angaria/ui components instead of hand-rolling per-page blocks.
 */
export const layout = create({
  // Medium weight, never bold: the canon has 400 and 500 only.
  heading: {
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
    letterSpacing: '-0.01em',
    lineHeight: 1.3,
    margin: 0,
    textWrap: 'balance',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  muted: {
    color: colors.muted,
  },
  // A section the header or another page links to stops short of the top edge.
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    scrollMarginBlockStart: spacing.s8,
  },
  small: {
    fontSize: font.sizeSm,
  },
  strong: {
    fontWeight: font.weightMedium,
  },
  text: {
    margin: 0,
    textWrap: 'pretty',
  },
  title: {
    fontSize: 'clamp(28px, 5.6vw, 40px)',
    fontWeight: font.weightMedium,
    letterSpacing: '-0.025em',
    lineHeight: 1.15,
    margin: 0,
    textWrap: 'balance',
  },
});
