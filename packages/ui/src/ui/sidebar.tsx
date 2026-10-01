'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { ComponentProps } from 'react';
import { colors, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';

// A macOS-style source list: a fixed-width column of section headings and
// 28px rows. No collapse, mobile sheet or cookie state; the app owns layout.
const styles = create({
  content: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: '1rem',
    minHeight: 0,
    overflowY: 'auto',
    paddingBlock: '0.5rem',
    paddingInline: '0.5rem',
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    padding: '0.5rem',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    minWidth: 0,
  },
  groupLabel: {
    alignItems: 'center',
    color: colors.mutedForeground,
    display: 'flex',
    fontSize: '0.6875rem',
    fontWeight: 500,
    height: '1.5rem',
    paddingInline: '0.5rem',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '0.5rem',
  },
  menu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    listStyle: 'none',
    margin: 0,
    minWidth: 0,
    padding: 0,
  },
  menuBadge: {
    color: colors.mutedForeground,
    flexShrink: 0,
    fontSize: '0.75rem',
    fontVariantNumeric: 'tabular-nums',
    marginInlineStart: 'auto',
  },
  menuButton: {
    alignItems: 'center',
    backgroundColor: {
      ':hover': colors.sidebarAccent,
      default: 'transparent',
    },
    borderRadius: radius.md,
    borderWidth: 0,
    boxShadow: {
      ':focus-visible': `0 0 0 2px ${colors.sidebarRing}`,
      default: null,
    },
    boxSizing: 'border-box',
    color: colors.sidebarForeground,
    cursor: 'default',
    display: 'flex',
    fontFamily: 'inherit',
    fontSize: '0.8125rem',
    // Selection shows in the row's fill, never in the text weight.
    fontWeight: 400,
    gap: '0.5rem',
    height: '1.75rem',
    margin: 0,
    minWidth: 0,
    outline: 'none',
    overflow: 'hidden',
    paddingInline: '0.5rem',
    textAlign: 'start',
    textDecorationLine: 'none',
    whiteSpace: 'nowrap',
    width: '100%',
  },
  menuButtonActive: {
    backgroundColor: colors.sidebarAccent,
    color: colors.sidebarAccentForeground,
  },
  menuItem: {
    minWidth: 0,
    position: 'relative',
  },
  root: {
    backgroundColor: colors.sidebar,
    borderInlineEndColor: colors.sidebarBorder,
    borderInlineEndStyle: 'solid',
    borderInlineEndWidth: '1px',
    boxSizing: 'border-box',
    color: colors.sidebarForeground,
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    height: '100%',
    userSelect: 'none',
    width: 'var(--sidebar-width, 13.75rem)',
  },
  separator: {
    backgroundColor: colors.sidebarBorder,
    borderWidth: 0,
    flexShrink: 0,
    height: '1px',
    marginBlock: 0,
    marginInline: '0.5rem',
  },
});

type SidebarPartProps<Tag extends 'aside' | 'div' | 'hr' | 'li' | 'span' | 'ul'> = Omit<
  ComponentProps<Tag>,
  'style'
> & {
  style?: StyleXStyles | undefined;
};

/** The sidebar column. Width comes from `--sidebar-width` (default 220px). */
const Sidebar = ({ className, style, ...props }: SidebarPartProps<'aside'>) => (
  <aside
    data-slot="sidebar"
    {...stylexProps(styles.root, customClassName(className), style)}
    {...props}
  />
);

/**
 * Top of the sidebar. Under a macOS overlay titlebar, give it room for the
 * window controls (a StyleX `style` with paddingTop) and the drag region.
 */
const SidebarHeader = ({ className, style, ...props }: SidebarPartProps<'div'>) => (
  <div
    data-slot="sidebar-header"
    {...stylexProps(styles.header, customClassName(className), style)}
    {...props}
  />
);

/** The scrolling middle that holds the groups. */
const SidebarContent = ({ className, style, ...props }: SidebarPartProps<'div'>) => (
  <div
    data-slot="sidebar-content"
    {...stylexProps(styles.content, customClassName(className), style)}
    {...props}
  />
);

const SidebarFooter = ({ className, style, ...props }: SidebarPartProps<'div'>) => (
  <div
    data-slot="sidebar-footer"
    {...stylexProps(styles.footer, customClassName(className), style)}
    {...props}
  />
);

const SidebarSeparator = ({ className, style, ...props }: SidebarPartProps<'hr'>) => (
  <hr
    data-slot="sidebar-separator"
    {...stylexProps(styles.separator, customClassName(className), style)}
    {...props}
  />
);

/** One section: an optional SidebarGroupLabel, then a SidebarMenu. */
const SidebarGroup = ({ className, style, ...props }: SidebarPartProps<'div'>) => (
  <div
    data-slot="sidebar-group"
    {...stylexProps(styles.group, customClassName(className), style)}
    {...props}
  />
);

/** The section heading above a group of rows. */
const SidebarGroupLabel = ({ className, style, ...props }: SidebarPartProps<'div'>) => (
  <div
    data-slot="sidebar-group-label"
    {...stylexProps(styles.groupLabel, customClassName(className), style)}
    {...props}
  />
);

const SidebarMenu = ({ className, style, ...props }: SidebarPartProps<'ul'>) => (
  <ul
    data-slot="sidebar-menu"
    {...stylexProps(styles.menu, customClassName(className), style)}
    {...props}
  />
);

const SidebarMenuItem = ({ className, style, ...props }: SidebarPartProps<'li'>) => (
  <li
    data-slot="sidebar-menu-item"
    {...stylexProps(styles.menuItem, customClassName(className), style)}
    {...props}
  />
);

export type SidebarMenuButtonProps = Omit<
  useRender.ComponentProps<'button'>,
  'className' | 'style'
> & {
  className?: string | undefined;
  /** The current route: filled row and `aria-current="page"`. */
  isActive?: boolean | undefined;
  style?: StyleXStyles | undefined;
};

/**
 * A navigation row. Renders a <button>; pass `render={<Link to="..." />}` to
 * render a router link with the same look.
 */
const SidebarMenuButton = ({
  className,
  isActive = false,
  render,
  style,
  ...props
}: SidebarMenuButtonProps) => {
  const styleProps = stylexProps(
    styles.menuButton,
    isActive && styles.menuButtonActive,
    customClassName(className),
    style,
  );

  return useRender({
    defaultTagName: 'button',
    props: mergeProps(
      {
        'aria-current': isActive ? ('page' as const) : undefined,
        className: styleProps.className,
        'data-active': isActive ? '' : undefined,
        'data-slot': 'sidebar-menu-button',
        style: styleProps.style,
        type: render === undefined ? ('button' as const) : undefined,
      },
      props,
    ),
    render,
    state: {
      active: isActive,
    },
  });
};

/** A trailing count or hint inside a SidebarMenuButton. */
const SidebarMenuBadge = ({ className, style, ...props }: SidebarPartProps<'span'>) => (
  <span
    data-slot="sidebar-menu-badge"
    {...stylexProps(styles.menuBadge, customClassName(className), style)}
    {...props}
  />
);

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
};
