import { capStyles } from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { ChevronRightIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { tones } from '../shell/palette.stylex.ts';

const styles = create({
  body: {
    paddingTop: spacing.s3,
  },
  hint: {
    color: colors.muted,
    fontSize: font.sizeXs,
    fontWeight: font.weightRegular,
  },
  icon: {
    color: colors.muted,
    height: '1rem',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '150ms',
    },
    transitionProperty: 'transform',
    width: '1rem',
  },
  iconOpen: {
    transform: 'rotate(90deg)',
  },
  summary: {
    '::-webkit-details-marker': {
      display: 'none',
    },
    alignItems: 'center',
    borderRadius: radius.base,
    color: colors.fg,
    cursor: 'pointer',
    display: 'flex',
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    gap: spacing.s2,
    listStyle: 'none',
    outline: {
      ':focus-visible': `1px solid ${tones.ring}`,
      default: 'none',
    },
    outlineOffset: '4px',
    paddingInline: spacing.s1,
    userSelect: 'none',
  },
});

/** A folded part of a settings page: a chevron, a label and a hint; open, `children` under it. */
export function Disclosure({
  children,
  defaultOpen = false,
  hint,
  label,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  hint?: ReactNode;
  label: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)} open={open}>
      <summary {...props(styles.summary)}>
        <ChevronRightIcon aria-hidden {...props(styles.icon, open && styles.iconOpen)} />
        <span {...props(capStyles.text)}>{label}</span>
        {hint && <span {...props(styles.hint, capStyles.text)}>{hint}</span>}
      </summary>
      <div {...props(styles.body)}>{children}</div>
    </details>
  );
}
