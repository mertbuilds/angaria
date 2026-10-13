import type { Popover } from '@base-ui/react/popover';
import { create } from '@stylexjs/stylex';
import { useCallback, useState } from 'react';
import { colors, radius } from './tokens.stylex.ts';

/** Base UI's transition status while a popup mounts or unmounts. */
export const isHidden = (status: string | undefined) =>
  status === 'starting' || status === 'ending';

// Whether the last input was a key: a popup opened from the keyboard (typing
// in a combobox, Space on a select, Alt+↓) shows at once.
let keyboardInput = false;
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', () => (keyboardInput = true), true);
  document.addEventListener('pointerdown', () => (keyboardInput = false), true);
}

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
 * The floating surface shared by Select, Popover, Menu, Combobox and the date
 * popover: 8px corners and a 1px border instead of a shadow. Its motion comes
 * from popupMotion.
 */
export const popupStyles = create({
  hidden: {
    opacity: 0,
    transform: 'scale(0.97)',
  },
  // No motion: a keyboard open, every close.
  instant: {
    transitionDuration: '0s',
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
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '150ms',
    },
    transitionProperty: 'opacity, transform',
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
  },
});

/**
 * A popup's motion for its Base UI transition `status`, after popupStyles.surface:
 * opened by a pointer it fades in and settles from 97% in 150ms from its
 * trigger; opened from the keyboard, under reduced motion and when it closes
 * it shows or goes at once.
 */
export const popupMotion = (status: string | undefined) => [
  isHidden(status) && popupStyles.hidden,
  (status === 'ending' || keyboardInput) && popupStyles.instant,
];
