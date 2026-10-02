'use client';

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { CheckIcon, MinusIcon } from 'lucide-react';
import { colors } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';

const styles = create({
  checked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    color: colors.primaryForeground,
  },
  disabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  icon: {
    height: '0.75rem',
    pointerEvents: 'none',
    width: '0.75rem',
  },
  indicator: {
    color: 'currentColor',
    display: 'grid',
    placeContent: 'center',
  },
  invalid: {
    borderColor: colors.destructive,
    boxShadow: `0 0 0 3px color-mix(in oklab, ${colors.destructive} 20%, transparent)`,
  },
  invalidChecked: {
    backgroundColor: colors.destructive,
    borderColor: colors.destructive,
  },
  root: {
    // Extends the 16px box to a ~40px hit area.
    '::after': {
      content: '',
      inset: '-12px',
      position: 'absolute',
    },
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.input,
    borderRadius: '4px',
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.primaryForeground,
    cursor: 'pointer',
    display: 'inline-flex',
    flexShrink: 0,
    height: '1rem',
    justifyContent: 'center',
    margin: 0,
    // A 2px ring 2px off the control: visible on a fill of the ring's own color.
    outlineColor: colors.ring,
    outlineOffset: '2px',
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: '2px',
    padding: 0,
    position: 'relative',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '150ms',
    },
    transitionProperty: 'color, background-color, border-color, box-shadow',
    width: '1rem',
  },
});

export type CheckboxProps = Omit<CheckboxPrimitive.Root.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const Checkbox = ({ className, style, ...props }: CheckboxProps) => {
  const isAriaInvalid = Boolean(props['aria-invalid']) && props['aria-invalid'] !== 'false';

  return (
    <CheckboxPrimitive.Root
      className={(state) => {
        const isInvalid = state.valid === false || isAriaInvalid;
        const isOn = state.checked || state.indeterminate;
        return stylexProps(
          styles.root,
          isOn && styles.checked,
          isInvalid && styles.invalid,
          isInvalid && isOn && styles.invalidChecked,
          state.disabled && styles.disabled,
          customClassName(className),
          style,
        ).className;
      }}
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        render={(indicatorProps, state) => (
          <span {...indicatorProps} {...stylexProps(styles.indicator)}>
            {state.indeterminate ? (
              <MinusIcon {...stylexProps(styles.icon)} strokeWidth={3} />
            ) : (
              <CheckIcon {...stylexProps(styles.icon)} strokeWidth={3} />
            )}
          </span>
        )}
      />
    </CheckboxPrimitive.Root>
  );
};

export { Checkbox };
