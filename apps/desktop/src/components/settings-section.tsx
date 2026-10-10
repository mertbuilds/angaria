import { FieldError } from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { tones } from '../shell/palette.stylex.ts';

const styles = create({
  // As wide as its contents, up to 70% of the row (a longer value ellipsizes):
  // the label and hint take the rest.
  control: {
    alignItems: 'center',
    display: 'flex',
    flex: '0 0 auto',
    gap: spacing.s2,
    justifyContent: 'flex-end',
    maxWidth: '70%',
    minWidth: 0,
  },
  controlFill: {
    flex: 1,
    maxWidth: 'none',
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
  field: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: spacing.s1,
    minWidth: 0,
  },
  // A compact field at the row's end, its message under it, aligned to it.
  fieldEnd: {
    alignItems: 'flex-end',
    textAlign: 'end',
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
  // Under a field, in line with the field's text.
  fieldMessage: {
    paddingInline: spacing.s4,
  },
  fieldNote: {
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: font.sizeXs,
    gap: spacing.s2,
    lineHeight: 1.5,
  },
  label: {
    display: 'flex',
    flex: '1 1 13rem',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  // Beside a field that fills the row.
  labelFixed: {
    flex: '0 0 13rem',
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
 * One row: label and hint on the left, taking the row's free width, the
 * control on the right at its own width. Pass `htmlFor` when the control is a
 * form field, `fill` when that field fills the row (the label then keeps a
 * fixed width), `align="top"` for tall controls.
 * A control named by aria-labelledby (a chip group) passes `id`: the label is
 * then `{id}-label` and the hint `{id}-hint`.
 */
export function SettingsRow({
  align = 'center',
  children,
  fill = false,
  hint,
  htmlFor,
  id,
  label,
}: {
  align?: 'center' | 'top';
  children?: ReactNode;
  fill?: boolean;
  hint?: ReactNode;
  htmlFor?: string;
  id?: string;
  label?: ReactNode;
}) {
  return (
    <div {...props(styles.row, align === 'top' && styles.rowTop)}>
      {label !== undefined && (
        <div
          {...props(styles.label, fill && styles.labelFixed, align === 'top' && styles.labelTop)}
        >
          {htmlFor ? (
            <label htmlFor={htmlFor} {...props(styles.labelText)}>
              {label}
            </label>
          ) : (
            <span id={id && `${id}-label`} {...props(styles.labelText)}>
              {label}
            </span>
          )}
          {hint && (
            <span id={id && `${id}-hint`} {...props(styles.hint)}>
              {hint}
            </span>
          )}
        </div>
      )}
      <div {...props(styles.control, (fill || label === undefined) && styles.controlFill)}>
        {children}
      </div>
    </div>
  );
}

/**
 * A row's field with its message under it: the error once there is one, else
 * the note. `children` gets the ids to put in the field's aria-describedby.
 * `errorAction` (a link button) follows the error's text.
 */
export function SettingsField({
  align = 'start',
  children,
  error,
  errorAction,
  id,
  note,
}: {
  /** `end` for a compact field that sits at the row's end. */
  align?: 'end' | 'start';
  children: (describedBy: string | undefined) => ReactNode;
  error?: string | undefined;
  errorAction?: ReactNode;
  id: string;
  note?: ReactNode;
}) {
  const describedBy = error ? `${id}-error` : note ? `${id}-note` : undefined;
  return (
    <div {...props(styles.field, align === 'end' && styles.fieldEnd)}>
      {children(describedBy)}
      {error ? (
        <FieldError id={`${id}-error`} style={styles.fieldMessage}>
          {error}
          {errorAction && <> {errorAction}</>}
        </FieldError>
      ) : (
        note && (
          <div id={`${id}-note`} {...props(styles.fieldMessage, styles.fieldNote)}>
            {note}
          </div>
        )
      )}
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
