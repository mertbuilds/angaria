'use client';

import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { ComponentProps } from 'react';
import { colors, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';

const styles = create({
  ariaInvalid: {
    borderColor: colors.destructive,
    boxShadow: `0 0 0 3px color-mix(in oklab, ${colors.destructive} 20%, transparent)`,
  },
  root: {
    '::placeholder': {
      color: colors.mutedForeground,
    },
    appearance: 'none',
    backgroundColor: {
      ':disabled': `color-mix(in oklab, ${colors.input} 50%, transparent)`,
      default: 'transparent',
    },
    borderColor: {
      ':focus-visible': colors.ring,
      default: colors.input,
    },
    // Multi-line text is a surface, not a pill: 8px corners.
    borderRadius: radius.md,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: {
      ':focus-visible': `0 0 0 3px color-mix(in oklab, ${colors.ring} 50%, transparent)`,
      default: 'none',
    },
    boxSizing: 'border-box',
    color: colors.foreground,
    cursor: {
      ':disabled': 'not-allowed',
      default: 'auto',
    },
    display: 'flex',
    fieldSizing: 'content',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    minHeight: '5rem',
    opacity: {
      ':disabled': 0.5,
      default: 1,
    },
    outline: 'none',
    paddingBlock: '0.5rem',
    paddingInline: '1rem',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '150ms',
    },
    transitionProperty: 'color, background-color, border-color, box-shadow',
    transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
    width: '100%',
  },
});

export type TextareaProps = Omit<ComponentProps<'textarea'>, 'style'> & {
  style?: StyleXStyles | undefined;
};

const Textarea = ({ 'aria-invalid': ariaInvalid, className, style, ...props }: TextareaProps) => (
  <textarea
    aria-invalid={ariaInvalid}
    data-slot="textarea"
    {...stylexProps(
      styles.root,
      Boolean(ariaInvalid) && ariaInvalid !== 'false' && styles.ariaInvalid,
      customClassName(className),
      style,
    )}
    {...props}
  />
);

export { Textarea };
