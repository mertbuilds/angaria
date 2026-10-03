'use client';

import { create, props as stylexProps } from '@stylexjs/stylex';
import { ChevronDownIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { customClassName } from '../lib/utils.stylex.ts';
import { Button, type ButtonProps } from './button.tsx';
import { DropdownMenu, DropdownMenuTrigger } from './dropdown-menu.tsx';

const styles = create({
  group: {
    display: 'inline-flex',
    flexShrink: 0,
    // The halves press as one piece: the whole pill shrinks while the main
    // half is held (pointer or Space). The menu half anchors the menu, so
    // pressing it moves nothing; see Button's press scale.
    scale: {
      ':has(> [data-split-main]:active)': {
        '@media (prefers-reduced-motion: reduce)': '1',
        default: '0.96',
      },
      default: '1',
    },
    transitionDuration: '150ms',
    transitionProperty: 'scale',
    transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
  },
  icon: {
    height: '1rem',
    width: '1rem',
  },
  // Square at the seam; the hit area stops there too, so neither half takes
  // the other's clicks. A focused half's ring draws over its neighbor.
  main: {
    '::before': {
      insetInlineEnd: 0,
    },
    borderEndEndRadius: 0,
    borderStartEndRadius: 0,
    zIndex: {
      ':focus-visible': 1,
      default: null,
    },
  },
  menu: {
    '::before': {
      insetInlineStart: 0,
    },
    borderEndStartRadius: 0,
    borderStartStartRadius: 0,
    // The divider: a 1px gap between two fills.
    marginInlineStart: '1px',
    zIndex: {
      ':focus-visible': 1,
      default: null,
    },
  },
  // Outline halves share one border: the menu half's start edge is the divider.
  outlineMain: {
    borderInlineEndWidth: 0,
  },
  outlineMenu: {
    marginInlineStart: 0,
  },
});

export type SplitButtonProps = Omit<ButtonProps, 'nativeButton' | 'pressMotion' | 'render'> & {
  /** The menu the chevron opens: a DropdownMenuContent. */
  menu: ReactNode;
  /** The menu half: disabled with the main half unless set. */
  menuDisabled?: boolean | undefined;
  /** The chevron's accessible name. */
  menuLabel: string;
};

/**
 * A main action and a menu of related ones in one pill. Every prop but `menu*`,
 * `className` and `style` (the group's) goes to the main half; `variant`
 * styles both. Pressing the main half shrinks the whole pill; pressing the
 * chevron moves nothing, so its menu opens where it stays.
 */
const SplitButton = ({
  className,
  disabled = false,
  menu,
  menuDisabled = disabled,
  menuLabel,
  size = 'default',
  style,
  variant = 'default',
  ...mainProps
}: SplitButtonProps) => (
  <div
    data-slot="split-button"
    role="group"
    {...stylexProps(styles.group, customClassName(className), style)}
  >
    <Button
      {...mainProps}
      data-split-main=""
      disabled={disabled}
      pressMotion={false}
      size={size}
      style={[styles.main, variant === 'outline' && styles.outlineMain]}
      variant={variant}
    />
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={menuDisabled}
        render={
          <Button
            aria-label={menuLabel}
            pressMotion={false}
            size="icon"
            style={[styles.menu, variant === 'outline' && styles.outlineMenu]}
            variant={variant}
          />
        }
      >
        <ChevronDownIcon {...stylexProps(styles.icon)} />
      </DropdownMenuTrigger>
      {menu}
    </DropdownMenu>
  </div>
);

export { SplitButton };
