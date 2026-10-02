import { spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { brand } from '../lib/brand.stylex.ts';
import { layout } from '../lib/layout.ts';

/** Where the gutter has room for a heading's marker to hang outside the column. */
const HANG = '@media (min-width: 800px)';

const styles = create({
  heading: {
    '::before': {
      backgroundColor: brand.fill,
      borderRadius: 2,
      content: '',
      flexShrink: 0,
      height: 8,
      width: 8,
    },
    alignItems: 'center',
    display: 'flex',
    fontSize: 'clamp(22px, 3.2vw, 28px)',
    gap: spacing.s3,
    letterSpacing: '-0.02em',
    // The marker hangs in the gutter, so the words line up with the column.
    marginInlineStart: {
      default: null,
      [HANG]: `calc(-8px - ${spacing.s3})`,
    },
  },
  // Over a centered block, the marker and the words center together.
  headingCentered: {
    justifyContent: 'center',
    marginInlineStart: null,
  },
});

/** A section's title, led by the blue square the pages repeat as their marker. */
export function SectionHeading({
  centered = false,
  children,
  id,
}: {
  centered?: boolean;
  children: ReactNode;
  id: string;
}) {
  return (
    <h2 id={id} {...props(layout.heading, styles.heading, centered && styles.headingCentered)}>
      {children}
    </h2>
  );
}
