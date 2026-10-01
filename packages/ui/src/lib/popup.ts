import { create } from '@stylexjs/stylex';
import { motion } from '../tokens.stylex.ts';
import { colors, radius } from './tokens.stylex.ts';

/** Base UI's transition status while a popup mounts or unmounts. */
export const isHidden = (status: string | undefined) =>
  status === 'starting' || status === 'ending';

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
