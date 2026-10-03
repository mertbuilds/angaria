'use client';

import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { CheckIcon, ChevronRightIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { capStyles, capText } from '../lib/cap-text.tsx';
import { popupMotion, popupStyles, useHeldPlacement } from '../lib/popup.ts';
import { colors, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';

const styles = create({
  // Block: in the check indicator's inline wrapper, an inline icon sits on
  // the text baseline, about 3px above the middle of the row.
  icon: {
    display: 'block',
    flexShrink: 0,
    height: '1rem',
    pointerEvents: 'none',
    width: '1rem',
  },
  indicator: {
    alignItems: 'center',
    display: 'flex',
    height: '1rem',
    insetInlineStart: '0.5rem',
    justifyContent: 'center',
    pointerEvents: 'none',
    position: 'absolute',
    width: '1rem',
  },
  item: {
    alignItems: 'center',
    // Concentric with the 8px popup and its 4px padding.
    borderRadius: `calc(${radius.md} - 4px)`,
    cursor: 'default',
    display: 'flex',
    fontSize: '0.875rem',
    gap: '0.5rem',
    lineHeight: '1.25rem',
    outline: 'none',
    paddingBlock: '0.375rem',
    paddingInline: '0.5rem',
    position: 'relative',
    userSelect: 'none',
  },
  itemDestructive: {
    color: colors.destructive,
  },
  itemDestructiveHighlighted: {
    backgroundColor: `color-mix(in oklab, ${colors.destructive} 10%, transparent)`,
  },
  itemDisabled: {
    opacity: 0.5,
    pointerEvents: 'none',
  },
  itemHighlighted: {
    backgroundColor: colors.accent,
    color: colors.accentForeground,
  },
  itemInset: {
    paddingInlineStart: '2rem',
  },
  label: {
    color: colors.mutedForeground,
    fontSize: '0.75rem',
    fontWeight: 500,
    lineHeight: '1rem',
    paddingBlock: '0.375rem',
    paddingInline: '0.5rem',
  },
  labelInset: {
    paddingInlineStart: '2rem',
  },
  popup: {
    maxHeight: 'var(--available-height)',
    minWidth: '10rem',
    overflowX: 'hidden',
    overflowY: 'auto',
    padding: '0.25rem',
  },
  separator: {
    backgroundColor: colors.border,
    height: '1px',
    marginBlock: '0.25rem',
    marginInline: '-0.25rem',
  },
  shortcut: {
    color: colors.mutedForeground,
    fontSize: '0.75rem',
    letterSpacing: '0.05em',
    marginInlineStart: 'auto',
  },
  subTriggerIcon: {
    marginInlineStart: 'auto',
  },
});

type StyleXOverrides = {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const DropdownMenu = (props: MenuPrimitive.Root.Props) => (
  <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
);

const DropdownMenuTrigger = (props: MenuPrimitive.Trigger.Props) => (
  <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
);

const DropdownMenuGroup = (props: MenuPrimitive.Group.Props) => (
  <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
);

const DropdownMenuRadioGroup = (props: MenuPrimitive.RadioGroup.Props) => (
  <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
);

const DropdownMenuSub = (props: MenuPrimitive.SubmenuRoot.Props) => (
  <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />
);

type DropdownMenuContentProps = Omit<MenuPrimitive.Popup.Props, 'className' | 'style'> &
  Partial<
    Pick<
      MenuPrimitive.Positioner.Props,
      'align' | 'alignOffset' | 'collisionPadding' | 'side' | 'sideOffset'
    >
  > &
  StyleXOverrides;

const DropdownMenuContent = ({
  align = 'start',
  alignOffset = 0,
  className,
  collisionPadding = 8,
  side = 'bottom',
  sideOffset = 4,
  style,
  ...props
}: DropdownMenuContentProps) => {
  const placement = useHeldPlacement(side, align);
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        sideOffset={sideOffset}
        {...placement}
        {...stylexProps(popupStyles.positioner)}
      >
        <MenuPrimitive.Popup
          className={(state) =>
            stylexProps(
              popupStyles.surface,
              styles.popup,
              popupMotion(state.transitionStatus),
              customClassName(className),
              style,
            ).className
          }
          data-slot="dropdown-menu-content"
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
};

type DropdownMenuItemProps = Omit<MenuPrimitive.Item.Props, 'className' | 'style'> &
  StyleXOverrides & {
    inset?: boolean | undefined;
    variant?: 'default' | 'destructive' | undefined;
  };

const DropdownMenuItem = ({
  children,
  className,
  inset,
  style,
  variant = 'default',
  ...props
}: DropdownMenuItemProps) => (
  <MenuPrimitive.Item
    className={(state) =>
      stylexProps(
        styles.item,
        inset && styles.itemInset,
        variant === 'destructive' && styles.itemDestructive,
        state.highlighted &&
          (variant === 'destructive' ? styles.itemDestructiveHighlighted : styles.itemHighlighted),
        state.disabled && styles.itemDisabled,
        customClassName(className),
        style,
      ).className
    }
    data-inset={inset ? '' : undefined}
    data-slot="dropdown-menu-item"
    data-variant={variant}
    {...props}
  >
    {capText(children)}
  </MenuPrimitive.Item>
);

type DropdownMenuCheckboxItemProps = Omit<MenuPrimitive.CheckboxItem.Props, 'className' | 'style'> &
  StyleXOverrides;

const DropdownMenuCheckboxItem = ({
  children,
  className,
  style,
  ...props
}: DropdownMenuCheckboxItemProps) => (
  <MenuPrimitive.CheckboxItem
    className={(state) =>
      stylexProps(
        styles.item,
        styles.itemInset,
        state.highlighted && styles.itemHighlighted,
        state.disabled && styles.itemDisabled,
        customClassName(className),
        style,
      ).className
    }
    data-slot="dropdown-menu-checkbox-item"
    {...props}
  >
    <span {...stylexProps(styles.indicator)}>
      <MenuPrimitive.CheckboxItemIndicator>
        <CheckIcon {...stylexProps(styles.icon)} />
      </MenuPrimitive.CheckboxItemIndicator>
    </span>
    {capText(children)}
  </MenuPrimitive.CheckboxItem>
);

type DropdownMenuRadioItemProps = Omit<MenuPrimitive.RadioItem.Props, 'className' | 'style'> &
  StyleXOverrides;

const DropdownMenuRadioItem = ({
  children,
  className,
  style,
  ...props
}: DropdownMenuRadioItemProps) => (
  <MenuPrimitive.RadioItem
    className={(state) =>
      stylexProps(
        styles.item,
        styles.itemInset,
        state.highlighted && styles.itemHighlighted,
        state.disabled && styles.itemDisabled,
        customClassName(className),
        style,
      ).className
    }
    data-slot="dropdown-menu-radio-item"
    {...props}
  >
    <span {...stylexProps(styles.indicator)}>
      <MenuPrimitive.RadioItemIndicator>
        <CheckIcon {...stylexProps(styles.icon)} />
      </MenuPrimitive.RadioItemIndicator>
    </span>
    {capText(children)}
  </MenuPrimitive.RadioItem>
);

// A plain heading, so it works outside a DropdownMenuGroup too.
type DropdownMenuLabelProps = Omit<ComponentProps<'div'>, 'style'> & {
  inset?: boolean | undefined;
  style?: StyleXStyles | undefined;
};

const DropdownMenuLabel = ({ className, inset, style, ...props }: DropdownMenuLabelProps) => (
  <div
    data-inset={inset ? '' : undefined}
    data-slot="dropdown-menu-label"
    {...stylexProps(styles.label, inset && styles.labelInset, customClassName(className), style)}
    {...props}
  />
);

type DropdownMenuSeparatorProps = Omit<MenuPrimitive.Separator.Props, 'className' | 'style'> &
  StyleXOverrides;

const DropdownMenuSeparator = ({ className, style, ...props }: DropdownMenuSeparatorProps) => (
  <MenuPrimitive.Separator
    data-slot="dropdown-menu-separator"
    {...stylexProps(styles.separator, customClassName(className), style)}
    {...props}
  />
);

type DropdownMenuShortcutProps = Omit<ComponentProps<'span'>, 'style'> & {
  style?: StyleXStyles | undefined;
};

const DropdownMenuShortcut = ({ className, style, ...props }: DropdownMenuShortcutProps) => (
  <span
    data-slot="dropdown-menu-shortcut"
    {...stylexProps(styles.shortcut, capStyles.text, customClassName(className), style)}
    {...props}
  />
);

type DropdownMenuSubTriggerProps = Omit<MenuPrimitive.SubmenuTrigger.Props, 'className' | 'style'> &
  StyleXOverrides & {
    inset?: boolean | undefined;
  };

const DropdownMenuSubTrigger = ({
  children,
  className,
  inset,
  style,
  ...props
}: DropdownMenuSubTriggerProps) => (
  <MenuPrimitive.SubmenuTrigger
    className={(state) =>
      stylexProps(
        styles.item,
        inset && styles.itemInset,
        state.highlighted && styles.itemHighlighted,
        state.disabled && styles.itemDisabled,
        customClassName(className),
        style,
      ).className
    }
    data-inset={inset ? '' : undefined}
    data-slot="dropdown-menu-sub-trigger"
    {...props}
  >
    {capText(children)}
    <ChevronRightIcon {...stylexProps(styles.icon, styles.subTriggerIcon)} />
  </MenuPrimitive.SubmenuTrigger>
);

const DropdownMenuSubContent = (props: DropdownMenuContentProps) => (
  <DropdownMenuContent
    align="start"
    alignOffset={-4}
    data-slot="dropdown-menu-sub-content"
    side="right"
    sideOffset={0}
    {...props}
  />
);

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};

export type {
  DropdownMenuCheckboxItemProps,
  DropdownMenuContentProps,
  DropdownMenuItemProps,
  DropdownMenuLabelProps,
  DropdownMenuRadioItemProps,
  DropdownMenuSeparatorProps,
  DropdownMenuShortcutProps,
  DropdownMenuSubTriggerProps,
};
