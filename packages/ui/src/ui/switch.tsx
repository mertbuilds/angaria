'use client';

import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { colors, optional, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';
import { motion } from '../tokens.stylex.ts';

const styles = create({
  root: {
    // Extends the track to a ~40px hit area.
    '::after': {
      content: '',
      insetBlock: '-10px',
      insetInline: '-6px',
      position: 'absolute',
    },
    alignItems: 'center',
    backgroundColor: colors.input,
    borderColor: 'transparent',
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: '2px',
    boxShadow: {
      ':focus-visible': `0 0 0 1px ${colors.ring}`,
      default: null,
    },
    boxSizing: 'border-box',
    cursor: 'pointer',
    display: 'inline-flex',
    flexShrink: 0,
    height: '1.25rem',
    margin: 0,
    outline: 'none',
    padding: 0,
    position: 'relative',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: motion.fade,
    },
    transitionProperty: 'background-color, box-shadow',
    width: '2.25rem',
  },
  rootChecked: {
    backgroundColor: colors.primary,
  },
  rootDisabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  rootInvalid: {
    borderColor: colors.destructive,
  },
  thumb: {
    backgroundColor: optional.switchThumb,
    borderRadius: radius.full,
    display: 'block',
    height: '1rem',
    pointerEvents: 'none',
    transform: 'translateX(0)',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: motion.move,
    },
    transitionProperty: 'transform',
    transitionTimingFunction: motion.ease,
    width: '1rem',
  },
  thumbChecked: {
    transform: 'translateX(1rem)',
  },
});

export type SwitchProps = Omit<SwitchPrimitive.Root.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const Switch = ({ className, style, ...props }: SwitchProps) => (
  <SwitchPrimitive.Root
    className={(state) =>
      stylexProps(
        styles.root,
        state.checked && styles.rootChecked,
        state.valid === false && styles.rootInvalid,
        state.disabled && styles.rootDisabled,
        customClassName(className),
        style,
      ).className
    }
    data-slot="switch"
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={(state) =>
        stylexProps(styles.thumb, state.checked && styles.thumbChecked).className
      }
      data-slot="switch-thumb"
    />
  </SwitchPrimitive.Root>
);

export { Switch };
