'use client';

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { createContext, useContext } from 'react';
import { colors, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';

export type TabsListVariant = 'default' | 'line';

const TabsVariantContext = createContext<TabsListVariant>('default');

const styles = create({
  list: {
    alignItems: 'center',
    boxSizing: 'border-box',
    color: colors.mutedForeground,
    display: 'inline-flex',
    justifyContent: 'center',
    width: 'fit-content',
  },
  listHorizontal: {
    height: '2rem',
  },
  // Segmented control: a gray pill track holding 28px pill tabs.
  listVariantDefault: {
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    padding: '2px',
  },
  listVariantLine: {
    backgroundColor: 'transparent',
    gap: '0.25rem',
  },
  listVertical: {
    flexDirection: 'column',
    height: 'fit-content',
  },
  panel: {
    flex: 1,
    fontSize: '0.875rem',
    outline: 'none',
  },
  root: {
    display: 'flex',
    gap: '0.5rem',
  },
  rootHorizontal: {
    flexDirection: 'column',
  },
  rootVertical: {
    flexDirection: 'row',
  },
  trigger: {
    '::after': {
      backgroundColor: colors.foreground,
      content: '',
      opacity: 0,
      position: 'absolute',
      transitionDuration: {
        '@media (prefers-reduced-motion: reduce)': '0s',
        default: '150ms',
      },
      transitionProperty: 'opacity',
    },
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: radius.full,
    borderStyle: 'none',
    borderWidth: 0,
    boxShadow: {
      ':focus-visible': `0 0 0 3px color-mix(in oklab, ${colors.ring} 50%, transparent)`,
      default: null,
    },
    boxSizing: 'border-box',
    color: {
      ':hover': colors.foreground,
      default: colors.mutedForeground,
    },
    cursor: 'pointer',
    display: 'inline-flex',
    flex: 1,
    fontFamily: 'inherit',
    fontSize: '0.8rem',
    fontWeight: 500,
    gap: '0.375rem',
    height: '1.75rem',
    justifyContent: 'center',
    lineHeight: '1rem',
    outline: 'none',
    paddingBlock: 0,
    paddingInline: '0.75rem',
    position: 'relative',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '150ms',
    },
    transitionProperty: 'background-color, color, box-shadow',
    transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
    whiteSpace: 'nowrap',
  },
  // The selected tab is marked by its surface and a 1px edge, never by weight.
  triggerActiveDefault: {
    backgroundColor: colors.background,
    boxShadow: {
      ':focus-visible': `0 0 0 3px color-mix(in oklab, ${colors.ring} 50%, transparent)`,
      default: `inset 0 0 0 1px ${colors.border}`,
    },
    color: colors.foreground,
  },
  triggerActiveLine: {
    '::after': {
      opacity: 1,
    },
    color: colors.foreground,
  },
  triggerAfterHorizontalLine: {
    '::after': {
      bottom: '-3px',
      height: '1px',
      left: '0.75rem',
      right: '0.75rem',
    },
  },
  triggerAfterVerticalLine: {
    '::after': {
      bottom: '0.25rem',
      right: '-3px',
      top: '0.25rem',
      width: '1px',
    },
  },
  triggerDisabled: {
    opacity: 0.5,
    pointerEvents: 'none',
  },
  triggerVertical: {
    justifyContent: 'flex-start',
    width: '100%',
  },
});

export type TabsProps = Omit<TabsPrimitive.Root.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const Tabs = ({ className, orientation = 'horizontal', style, ...props }: TabsProps) => (
  <TabsPrimitive.Root
    className={(state) =>
      stylexProps(
        styles.root,
        state.orientation === 'vertical' ? styles.rootVertical : styles.rootHorizontal,
        customClassName(className),
        style,
      ).className
    }
    data-slot="tabs"
    orientation={orientation}
    {...props}
  />
);

export type TabsListProps = Omit<TabsPrimitive.List.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
  variant?: TabsListVariant | undefined;
};

const TabsList = ({ className, style, variant = 'default', ...props }: TabsListProps) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.List
      className={(state) =>
        stylexProps(
          styles.list,
          state.orientation === 'vertical' ? styles.listVertical : styles.listHorizontal,
          variant === 'line' ? styles.listVariantLine : styles.listVariantDefault,
          customClassName(className),
          style,
        ).className
      }
      data-slot="tabs-list"
      data-variant={variant}
      {...props}
    />
  </TabsVariantContext.Provider>
);

export type TabsTriggerProps = Omit<TabsPrimitive.Tab.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const TabsTrigger = ({ className, style, ...props }: TabsTriggerProps) => {
  const variant = useContext(TabsVariantContext);
  const isLine = variant === 'line';

  return (
    <TabsPrimitive.Tab
      className={(state) => {
        const isVertical = state.orientation === 'vertical';
        return stylexProps(
          styles.trigger,
          isVertical && styles.triggerVertical,
          isLine &&
            (isVertical ? styles.triggerAfterVerticalLine : styles.triggerAfterHorizontalLine),
          state.active && (isLine ? styles.triggerActiveLine : styles.triggerActiveDefault),
          state.disabled && styles.triggerDisabled,
          customClassName(className),
          style,
        ).className;
      }}
      data-slot="tabs-trigger"
      {...props}
    />
  );
};

export type TabsContentProps = Omit<TabsPrimitive.Panel.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const TabsContent = ({ className, style, ...props }: TabsContentProps) => (
  <TabsPrimitive.Panel
    data-slot="tabs-content"
    {...stylexProps(styles.panel, customClassName(className), style)}
    {...props}
  />
);

export { Tabs, TabsContent, TabsList, TabsTrigger };
