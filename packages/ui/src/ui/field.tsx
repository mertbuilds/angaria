'use client';

import type { StyleXStyles } from '@stylexjs/stylex';
import { create, props as stylexProps } from '@stylexjs/stylex';
import { CircleAlertIcon, TriangleAlertIcon } from 'lucide-react';
import { useMemo } from 'react';
import type { ComponentProps } from 'react';
import { capStyles } from '../lib/cap-text.tsx';
import { colors } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';
import { Label } from './label.tsx';
import type { LabelProps } from './label.tsx';
import { Separator } from './separator.tsx';

const styles = create({
  content: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: '0.375rem',
    lineHeight: 1.375,
  },
  description: {
    color: colors.mutedForeground,
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: 1.5,
    margin: 0,
  },
  // An icon beside the text: an error or warning never shows by color alone.
  error: {
    alignItems: 'flex-start',
    color: colors.destructive,
    display: 'flex',
    fontSize: '0.875rem',
    fontWeight: 400,
    gap: '0.375rem',
    lineHeight: 1.5,
  },
  errorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    margin: 0,
    paddingInlineStart: '1rem',
  },
  fieldBase: {
    display: 'flex',
    gap: '0.75rem',
    width: '100%',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.75rem',
    width: '100%',
  },
  horizontal: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  // Centered on the first line: 0.875rem text at a 1.5 line height, whose
  // caps the text's capStyles center.
  icon: {
    flexShrink: 0,
    height: '0.875rem',
    marginTop: {
      '@supports (text-box: trim-both cap alphabetic)': 'calc((1lh - 0.875rem) / 2)',
      default: '0.1875rem',
    },
    width: '0.875rem',
  },
  label: {
    alignItems: 'center',
    display: 'flex',
    gap: '0.5rem',
    lineHeight: 1.375,
    width: 'fit-content',
  },
  legend: {
    fontWeight: 500,
    marginBottom: '0.75rem',
    padding: 0,
  },
  legendLabel: {
    fontSize: '0.875rem',
  },
  legendLegend: {
    fontSize: '1rem',
  },
  responsive: {
    alignItems: { '@media (min-width: 768px)': 'center', default: null },
    flexDirection: { '@media (min-width: 768px)': 'row', default: 'column' },
  },
  separator: {
    alignItems: 'center',
    display: 'flex',
    fontSize: '0.875rem',
    height: '1.25rem',
    justifyContent: 'center',
    marginBlock: '-0.5rem',
    position: 'relative',
  },
  separatorContent: {
    backgroundColor: colors.background,
    color: colors.mutedForeground,
    display: 'block',
    marginInline: 'auto',
    paddingInline: '0.5rem',
    position: 'relative',
    width: 'fit-content',
  },
  separatorLine: {
    insetInline: 0,
    position: 'absolute',
    top: '50%',
  },
  set: {
    borderWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    margin: 0,
    minWidth: 0,
    padding: 0,
  },
  // The words of a message that cite a rule: the message's own color, a dashed
  // underline that turns solid on hover and focus.
  sourceLink: {
    borderRadius: '0.125rem',
    color: 'inherit',
    cursor: 'pointer',
    outlineColor: colors.ring,
    outlineOffset: '2px',
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: '2px',
    textDecorationLine: 'underline',
    textDecorationStyle: {
      ':focus-visible': 'solid',
      ':hover': 'solid',
      default: 'dashed',
    },
    textDecorationThickness: '1px',
    textUnderlineOffset: '3px',
  },
  title: {
    alignItems: 'center',
    display: 'flex',
    fontSize: '0.875rem',
    fontWeight: 500,
    gap: '0.5rem',
    lineHeight: 1.375,
    width: 'fit-content',
  },
  vertical: {
    flexDirection: 'column',
  },
  warning: {
    color: colors.warning,
  },
});

type FieldOrientation = 'vertical' | 'horizontal' | 'responsive';

const orientationStyles: Record<FieldOrientation, StyleXStyles> = {
  horizontal: styles.horizontal,
  responsive: styles.responsive,
  vertical: styles.vertical,
};

// `style` is merged into stylexProps, so it takes StyleX styles, not inline CSS.
type StyleXElementProps<Tag extends 'div' | 'fieldset' | 'legend' | 'p'> = Omit<
  ComponentProps<Tag>,
  'style'
> & {
  style?: StyleXStyles | undefined;
};

const FieldSet = ({ className, style, ...props }: StyleXElementProps<'fieldset'>) => (
  <fieldset
    {...stylexProps(styles.set, customClassName(className), style)}
    data-slot="field-set"
    {...props}
  />
);

const FieldLegend = ({
  className,
  style,
  variant = 'legend',
  ...props
}: StyleXElementProps<'legend'> & { variant?: 'legend' | 'label' | undefined }) => (
  <legend
    {...stylexProps(
      styles.legend,
      variant === 'label' ? styles.legendLabel : styles.legendLegend,
      customClassName(className),
      style,
    )}
    data-slot="field-legend"
    data-variant={variant}
    {...props}
  />
);

const FieldGroup = ({ className, style, ...props }: StyleXElementProps<'div'>) => (
  <div
    {...stylexProps(styles.group, customClassName(className), style)}
    data-slot="field-group"
    {...props}
  />
);

const Field = ({
  className,
  orientation = 'vertical',
  style,
  ...props
}: StyleXElementProps<'div'> & { orientation?: FieldOrientation | undefined }) => (
  <div
    {...stylexProps(
      styles.fieldBase,
      orientationStyles[orientation],
      customClassName(className),
      style,
    )}
    data-orientation={orientation}
    data-slot="field"
    role="group"
    {...props}
  />
);

const FieldContent = ({ className, style, ...props }: StyleXElementProps<'div'>) => (
  <div
    {...stylexProps(styles.content, customClassName(className), style)}
    data-slot="field-content"
    {...props}
  />
);

const FieldLabel = ({ style, ...props }: LabelProps) => (
  <Label data-slot="field-label" style={[styles.label, style]} {...props} />
);

const FieldTitle = ({ className, style, ...props }: StyleXElementProps<'div'>) => (
  <div
    {...stylexProps(styles.title, customClassName(className), style)}
    data-slot="field-label"
    {...props}
  />
);

const FieldDescription = ({ className, style, ...props }: StyleXElementProps<'p'>) => (
  <p
    {...stylexProps(styles.description, customClassName(className), style)}
    data-slot="field-description"
    {...props}
  />
);

const FieldSeparator = ({ children, className, style, ...props }: StyleXElementProps<'div'>) => {
  const content = stylexProps(styles.separatorContent);
  return (
    <div
      {...stylexProps(styles.separator, customClassName(className), style)}
      data-content={Boolean(children)}
      data-slot="field-separator"
      {...props}
    >
      <Separator style={styles.separatorLine} />
      {children ? (
        <span
          className={content.className}
          data-slot="field-separator-content"
          style={content.style}
        >
          {children}
        </span>
      ) : null}
    </div>
  );
};

interface SourceLinkProps {
  /** The words of the message that cite the rule, such as "VUK 231/5". */
  children: string;
  href: string;
  /** Full name of the rule, such as "VUK md. 231/5". */
  label: string;
  /** Opens `href` instead of the link's default, such as in the system browser. */
  onOpen?: ((href: string) => void) | undefined;
}

/**
 * The words of a message that cite a rule, as a link to its official text. The
 * accessible name starts with the words shown.
 */
const SourceLink = ({ children, href, label, onOpen }: SourceLinkProps) => (
  <a
    {...stylexProps(styles.sourceLink)}
    aria-label={`${label.includes(children) ? label : `${children} (${label})`}, resmî metni aç`}
    data-slot="source-link"
    href={href}
    onClick={(event) => {
      if (onOpen) {
        event.preventDefault();
        onOpen(href);
      }
    }}
    rel="noreferrer"
    target="_blank"
  >
    {children}
  </a>
);

/**
 * A field's error: an icon and the text. Point the control's aria-describedby
 * at its id. It is announced politely, never as an alert: show it once the
 * value is complete (the field was left, a choice made, the form submitted),
 * so a screen reader is not interrupted while the user types.
 */
const FieldError = ({
  children,
  className,
  errors,
  style,
  ...props
}: StyleXElementProps<'div'> & {
  errors?: Array<{ message?: string | undefined } | undefined> | undefined;
}) => {
  const content = useMemo(() => {
    if (children) {
      return children;
    }
    if (!errors?.length) {
      return null;
    }
    const uniqueErrors = [...new Map(errors.map((error) => [error?.message, error])).values()];
    if (uniqueErrors.length === 1) {
      return uniqueErrors[0]?.message;
    }
    return (
      <ul {...stylexProps(styles.errorList)}>
        {uniqueErrors.map((error) =>
          error?.message ? <li key={error.message}>{error.message}</li> : null,
        )}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }
  return (
    <div
      {...stylexProps(styles.error, customClassName(className), style)}
      aria-live="polite"
      data-slot="field-error"
      {...props}
    >
      <CircleAlertIcon aria-hidden {...stylexProps(styles.icon)} />
      <div {...stylexProps(capStyles.text)}>{content}</div>
    </div>
  );
};

/**
 * A rule the value breaks that does not block, such as a date older than seven
 * days: an amber icon and the text, announced politely.
 */
const FieldWarning = ({ children, className, style, ...props }: StyleXElementProps<'div'>) => {
  if (!children) {
    return null;
  }
  return (
    <div
      {...stylexProps(styles.error, styles.warning, customClassName(className), style)}
      data-slot="field-warning"
      role="status"
      {...props}
    >
      <TriangleAlertIcon aria-hidden {...stylexProps(styles.icon)} />
      <div {...stylexProps(capStyles.text)}>{children}</div>
    </div>
  );
};

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  FieldWarning,
  SourceLink,
  type SourceLinkProps,
};
