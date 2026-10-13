'use client';

import { Input as InputPrimitive } from '@base-ui/react/input';
import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { ComponentProps } from 'react';
import { colors, fontMetrics, optional, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';

const styles = create({
  // Invalid is the border, a ring and the FieldError text with its icon, never
  // color alone. Focus stays visible: the ring tightens to 1px.
  ariaInvalid: {
    borderColor: colors.destructive,
    boxShadow: {
      ':focus-visible': `0 0 0 1px ${colors.destructive}`,
      default: `0 0 0 3px color-mix(in oklab, ${colors.destructive} 20%, transparent)`,
    },
  },
  root: {
    '::file-selector-button': {
      backgroundColor: 'transparent',
      borderWidth: 0,
      color: colors.foreground,
      display: 'inline-flex',
      fontSize: '0.875rem',
      fontWeight: 500,
      height: '1.5rem',
    },
    '::placeholder': {
      color: colors.mutedForeground,
    },
    // iOS Safari otherwise paints its own inner shadow on text inputs.
    appearance: 'none',
    backgroundColor: {
      ':disabled': colors.muted,
      default: optional.inputBackground,
    },
    // --input is at least 3:1 against the fill and the surface around it.
    borderColor: {
      ':focus-visible': colors.ring,
      ':hover': { '@media (hover: hover)': optional.inputHover, default: null },
      default: colors.input,
    },
    borderRadius: radius.full,
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
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    // 40px pill, the canon input height.
    height: '2.5rem',
    lineHeight: '1.25rem',
    minWidth: 0,
    opacity: {
      ':disabled': 0.5,
      default: 1,
    },
    outline: 'none',
    // The value's caps on the middle, level with an icon or button inside the field.
    paddingBottom: `calc(0.25rem - ${fontMetrics.capOffset})`,
    paddingInline: '1rem',
    paddingTop: `calc(0.25rem + ${fontMetrics.capOffset})`,
    pointerEvents: {
      ':disabled': 'none',
      default: null,
    },
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

export type InputProps = Omit<ComponentProps<'input'>, 'style'> & {
  style?: StyleXStyles | undefined;
};

const Input = ({ 'aria-invalid': ariaInvalid, className, style, type, ...props }: InputProps) => (
  <InputPrimitive
    aria-invalid={ariaInvalid}
    data-slot="input"
    type={type}
    {...stylexProps(
      styles.root,
      Boolean(ariaInvalid) && ariaInvalid !== 'false' && styles.ariaInvalid,
      customClassName(className),
      style,
    )}
    {...props}
  />
);

export { Input, styles as inputStyles };
