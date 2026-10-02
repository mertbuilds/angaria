import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { tones } from '../shell/palette.stylex.ts';

const styles = create({
  control: {
    alignItems: 'center',
    display: 'flex',
    flex: 1,
    gap: spacing.s2,
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  description: {
    color: colors.muted,
    fontSize: font.sizeXs,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  error: {
    color: colors.error,
  },
  group: {
    backgroundColor: tones.card,
    borderRadius: radius.base,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    paddingInline: spacing.s1,
  },
  hint: {
    color: colors.muted,
    fontSize: font.sizeXs,
    lineHeight: 1.5,
    textWrap: 'pretty',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    gap: '2px',
    width: '13rem',
  },
  labelTop: {
    paddingTop: spacing.s2,
  },
  labelText: {
    color: colors.fg,
    fontSize: font.sizeSm,
    lineHeight: 1.4,
  },
  row: {
    alignItems: 'center',
    borderTopColor: tones.divider,
    borderTopStyle: 'solid',
    borderTopWidth: {
      ':first-child': 0,
      default: '1px',
    },
    display: 'flex',
    gap: spacing.s4,
    minHeight: spacing.s12,
    paddingBlock: spacing.s2,
    paddingInline: spacing.s4,
  },
  rowTop: {
    alignItems: 'flex-start',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  title: {
    color: colors.fg,
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    lineHeight: 1.4,
    margin: 0,
  },
  value: {
    color: colors.fg,
    fontSize: font.sizeSm,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.4,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  valueMuted: {
    color: colors.muted,
  },
  warning: {
    color: colors.warning,
  },
});

/** A titled group of rows, like a pane section in macOS System Settings. */
export function SettingsSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section {...props(styles.section)}>
      <header {...props(styles.header)}>
        <h2 {...props(styles.title)}>{title}</h2>
        {description && <p {...props(styles.description)}>{description}</p>}
      </header>
      <div {...props(styles.group)}>{children}</div>
    </section>
  );
}

/**
 * One row: label and hint on the left, the control on the right. Pass
 * `htmlFor` when the control is a form field, `align="top"` for tall controls.
 */
export function SettingsRow({
  align = 'center',
  children,
  hint,
  htmlFor,
  label,
}: {
  align?: 'center' | 'top';
  children?: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  label?: ReactNode;
}) {
  return (
    <div {...props(styles.row, align === 'top' && styles.rowTop)}>
      {label !== undefined && (
        <div {...props(styles.label, align === 'top' && styles.labelTop)}>
          {htmlFor ? (
            <label htmlFor={htmlFor} {...props(styles.labelText)}>
              {label}
            </label>
          ) : (
            <span {...props(styles.labelText)}>{label}</span>
          )}
          {hint && <span {...props(styles.hint)}>{hint}</span>}
        </div>
      )}
      <div {...props(styles.control)}>{children}</div>
    </div>
  );
}

const toneStyles = {
  default: null,
  error: styles.error,
  muted: styles.valueMuted,
  warning: styles.warning,
};

/** Read-only text in a row's control column. */
export function SettingsValue({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: keyof typeof toneStyles;
}) {
  return <span {...props(styles.value, toneStyles[tone])}>{children}</span>;
}
