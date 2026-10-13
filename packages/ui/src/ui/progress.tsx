'use client';

import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import { create, keyframes, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';
import { motion } from '../tokens.stylex.ts';

const slide = keyframes({
  '0%': { transform: 'translateX(-100%)' },
  '100%': { transform: 'translateX(250%)' },
});

const styles = create({
  header: {
    alignItems: 'baseline',
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  indicator: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    display: 'block',
    height: '100%',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: motion.move,
    },
    transitionProperty: 'width',
    transitionTimingFunction: motion.ease,
  },
  // No value yet: a short bar slides along the track; reduced motion holds it still.
  indicatorIndeterminate: {
    animationDuration: '1.4s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: slide,
    },
    animationTimingFunction: motion.ease,
    width: '40%',
  },
  label: {
    color: colors.foreground,
    fontSize: '0.875rem',
    lineHeight: 1.4,
    minWidth: 0,
  },
  root: {
    display: 'grid',
    gap: '0.5rem',
    minWidth: 0,
  },
  track: {
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    height: '0.375rem',
    overflow: 'hidden',
    position: 'relative',
  },
  value: {
    color: colors.mutedForeground,
    flexShrink: 0,
    fontSize: '0.8125rem',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
  },
});

export type ProgressProps = {
  className?: string | undefined;
  /** What is in progress, above the bar on the left. */
  label?: ReactNode;
  max?: number | undefined;
  style?: StyleXStyles | undefined;
  /** null while the amount is not known yet: the bar then slides. */
  value: number | null;
  /** How far, in words ("23/53 hafta"): above the bar on the right and read out as the value. */
  valueText?: string | undefined;
};

/** A labelled progress bar (Base UI Progress). */
const Progress = ({ className, label, max = 100, style, value, valueText }: ProgressProps) => (
  <ProgressPrimitive.Root
    aria-valuetext={valueText}
    data-slot="progress"
    max={max}
    value={value}
    {...stylexProps(styles.root, customClassName(className), style)}
  >
    {(label || valueText) && (
      <div {...stylexProps(styles.header)}>
        {label && (
          <ProgressPrimitive.Label data-slot="progress-label" {...stylexProps(styles.label)}>
            {label}
          </ProgressPrimitive.Label>
        )}
        {valueText && (
          <span aria-hidden data-slot="progress-value" {...stylexProps(styles.value)}>
            {valueText}
          </span>
        )}
      </div>
    )}
    <ProgressPrimitive.Track data-slot="progress-track" {...stylexProps(styles.track)}>
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        {...stylexProps(styles.indicator, value === null && styles.indicatorIndeterminate)}
      />
    </ProgressPrimitive.Track>
  </ProgressPrimitive.Root>
);

export { Progress };
