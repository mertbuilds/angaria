'use client';

import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { colors, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';

const styles = create({
  root: {
    minHeight: 0,
    position: 'relative',
  },
  scrollbar: {
    display: 'flex',
    // Hidden until the area scrolls or the pointer is over it, like macOS
    // overlay scrollbars.
    opacity: {
      ':is([data-hovering], [data-scrolling])': 1,
      default: 0,
    },
    padding: '2px',
    touchAction: 'none',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '200ms',
    },
    transitionProperty: 'opacity',
    userSelect: 'none',
  },
  scrollbarHorizontal: {
    flexDirection: 'column',
    height: '0.5rem',
  },
  scrollbarVertical: {
    width: '0.5rem',
  },
  thumb: {
    backgroundColor: colors.mutedForeground,
    borderRadius: radius.full,
    flex: 1,
    opacity: 0.6,
    position: 'relative',
  },
  viewport: {
    borderRadius: 'inherit',
    boxShadow: {
      ':focus-visible': `0 0 0 1px ${colors.ring}`,
      default: 'none',
    },
    height: '100%',
    outline: 'none',
    width: '100%',
  },
});

export type ScrollBarProps = Omit<ScrollAreaPrimitive.Scrollbar.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const ScrollBar = ({ className, orientation = 'vertical', style, ...props }: ScrollBarProps) => (
  <ScrollAreaPrimitive.Scrollbar
    data-slot="scroll-area-scrollbar"
    orientation={orientation}
    {...stylexProps(
      styles.scrollbar,
      orientation === 'vertical' ? styles.scrollbarVertical : styles.scrollbarHorizontal,
      customClassName(className),
      style,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.Thumb data-slot="scroll-area-thumb" {...stylexProps(styles.thumb)} />
  </ScrollAreaPrimitive.Scrollbar>
);

export type ScrollAreaProps = Omit<ScrollAreaPrimitive.Root.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const ScrollArea = ({ children, className, style, ...props }: ScrollAreaProps) => (
  <ScrollAreaPrimitive.Root
    data-slot="scroll-area"
    {...stylexProps(styles.root, customClassName(className), style)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport
      data-slot="scroll-area-viewport"
      {...stylexProps(styles.viewport)}
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
  </ScrollAreaPrimitive.Root>
);

export { ScrollArea, ScrollBar };
