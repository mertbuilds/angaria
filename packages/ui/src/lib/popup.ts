import type { Popover } from '@base-ui/react/popover';
import { create } from '@stylexjs/stylex';
import { useCallback, useState } from 'react';
import { motion } from '../tokens.stylex.ts';
import { colors, radius } from './tokens.stylex.ts';

/** Base UI's transition status while a popup mounts or unmounts. */
export const isHidden = (status: string | undefined) =>
  status === 'starting' || status === 'ending';

type Side = NonNullable<Popover.Positioner.Props['side']>;
type Align = NonNullable<Popover.Positioner.Props['align']>;

const sides: ReadonlyArray<string> = [
  'bottom',
  'inline-end',
  'inline-start',
  'left',
  'right',
  'top',
];
const aligns: ReadonlyArray<string> = ['center', 'end', 'start'];
const isSide = (value: string | undefined): value is Side => sides.includes(value ?? '');
const isAlign = (value: string | undefined): value is Align => aligns.includes(value ?? '');

// Never flips again: the side stays, and the popup only slides along it to stay on screen.
const held = { align: 'shift', fallbackAxisSide: 'none', side: 'none' } as const;

/**
 * Keeps an anchored popup where it opened. Base UI picks the side as the popup
 * opens (the preferred one, the opposite one when only that has room); from
 * the next frame that side and alignment hold until the popup closes, so
 * content that changes height, a scroll or a resize never flips it. Spread
 * the result on the Positioner.
 */
export function useHeldPlacement(side: Side, align: Align) {
  const [placement, setPlacement] = useState<{ align: Align; side: Side } | null>(null);
  const ref = useCallback((positioner: HTMLDivElement) => {
    let frame = 0;
    // Select keeps its positioner mounted and `hidden` while closed, so each
    // open starts a new hold.
    const sync = () => {
      cancelAnimationFrame(frame);
      setPlacement(null);
      if (positioner.hidden) {
        return;
      }
      frame = requestAnimationFrame(() => {
        const { align: openAlign, side: openSide } = positioner.dataset;
        if (isSide(openSide) && isAlign(openAlign)) {
          setPlacement({ align: openAlign, side: openSide });
        }
      });
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(positioner, { attributeFilter: ['hidden'] });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      setPlacement(null);
    };
  }, []);
  return placement
    ? { ...placement, collisionAvoidance: held, ref }
    : { align, collisionAvoidance: undefined, ref, side };
}

/**
 * The floating surface shared by Select, Popover, Menu and Combobox: 8px
 * corners, a 1px border instead of a shadow, and the canon motion (opacity
 * fades in 200ms, the scale settles in 260ms). Reduced motion keeps the fade
 * and drops the scale.
 */
export const popupStyles = create({
  hidden: {
    opacity: 0,
    transform: 'scale(0.96)',
  },
  positioner: {
    isolation: 'isolate',
    outline: 'none',
    zIndex: 50,
  },
  surface: {
    backgroundColor: colors.popover,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.popoverForeground,
    fontSize: '0.875rem',
    opacity: 1,
    outline: 'none',
    transform: 'scale(1)',
    transformOrigin: 'var(--transform-origin)',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': `${motion.fade}, 0s`,
      default: `${motion.fade}, ${motion.move}`,
    },
    transitionProperty: 'opacity, transform',
    transitionTimingFunction: motion.ease,
  },
});
