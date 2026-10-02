'use client';

import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { ComponentProps } from 'react';
import { colors, optional } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';

const styles = create({
  ariaInvalid: {
    borderColor: colors.destructive,
    boxShadow: {
      ':focus-visible': `0 0 0 1px ${colors.destructive}`,
      default: `0 0 0 3px color-mix(in oklab, ${colors.destructive} 20%, transparent)`,
    },
  },
  root: {
    '::placeholder': {
      color: colors.mutedForeground,
    },
    appearance: 'none',
    backgroundColor: {
      ':disabled': colors.muted,
      default: optional.inputBackground,
    },
    borderColor: {
      ':focus-visible': colors.ring,
      ':hover': { '@media (hover: hover)': optional.inputHover, default: null },
      default: colors.input,
    },
    // The pill's radius system: a 40px pill has 20px ends, so multi-line text
    // keeps 20px corners, a rounded rect of the same family as Input.
    borderRadius: '1.25rem',
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: {
      ':focus-visible': `0 0 0 1px ${colors.ring}`,
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
    // The first line sits where a 40px Input's text sits.
    paddingBlock: 'calc(0.625rem - 1px)',
    paddingInline: '1rem',
    // Hover fades; focus (Tab moves it) shows at once.
    transitionDuration: {
      ':focus-visible': '0s',
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
