import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { tones } from '../shell/palette.stylex.ts';

/** Yeni fatura's sections and their two-column field grid. */
export const sectionStyles = create({
  fields: {
    display: 'grid',
    gap: spacing.s4,
    gridTemplateColumns: {
      '@media (min-width: 720px)': 'repeat(2, minmax(0, 1fr))',
      default: 'minmax(0, 1fr)',
    },
  },
  section: {
    borderTopColor: tones.divider,
    borderTopStyle: 'solid',
    borderTopWidth: {
      ':first-child': 0,
      default: '1px',
    },
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    paddingBlock: spacing.s6,
  },
  sectionHint: {
    color: colors.muted,
    fontSize: font.sizeXs,
  },
  sectionTitle: {
    color: colors.fg,
    fontSize: font.sizeMd,
    fontWeight: font.weightMedium,
    margin: 0,
  },
});

const styles = create({
  sectionHeader: {
    alignItems: 'baseline',
    display: 'flex',
    gap: spacing.s3,
    justifyContent: 'space-between',
  },
});

export function Section({
  children,
  hint,
  title,
}: {
  children: ReactNode;
  hint?: string;
  title: string;
}) {
  return (
    <section {...props(sectionStyles.section)}>
      <div {...props(styles.sectionHeader)}>
        <h2 {...props(sectionStyles.sectionTitle)}>{title}</h2>
        {hint && <span {...props(sectionStyles.sectionHint)}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}
