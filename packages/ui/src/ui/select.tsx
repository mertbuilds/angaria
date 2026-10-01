'use client';

import { Select as SelectPrimitive } from '@base-ui/react/select';
import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { isHidden, popupStyles } from '../lib/popup.ts';
import { colors, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';

const styles = create({
  content: {
    maxHeight: 'var(--available-height)',
    minWidth: '9rem',
    overflowX: 'hidden',
    overflowY: 'auto',
    position: 'relative',
    width: 'var(--anchor-width)',
  },
  group: {
    scrollMarginBlock: '0.25rem',
  },
  icon: {
    flexShrink: 0,
    height: '1rem',
    pointerEvents: 'none',
    width: '1rem',
  },
  item: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    // Concentric with the 8px popup and its 4px padding.
    borderRadius: `calc(${radius.md} - 4px)`,
    boxSizing: 'border-box',
    color: colors.foreground,
    cursor: 'default',
    display: 'flex',
    fontSize: '0.875rem',
    gap: '0.375rem',
    lineHeight: '1.25rem',
    outline: 'none',
    paddingBlock: '0.375rem',
    paddingLeft: '0.5rem',
    paddingRight: '2rem',
    position: 'relative',
    userSelect: 'none',
    width: '100%',
  },
  itemDisabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
    pointerEvents: 'none',
  },
  itemHighlighted: {
    backgroundColor: colors.accent,
    color: colors.accentForeground,
  },
  itemIndicator: {
    alignItems: 'center',
    display: 'flex',
    height: '1rem',
    justifyContent: 'center',
    pointerEvents: 'none',
    position: 'absolute',
    right: '0.5rem',
    width: '1rem',
  },
  itemText: {
    display: 'flex',
    flex: 1,
    flexShrink: 0,
    gap: '0.5rem',
    whiteSpace: 'nowrap',
  },
  label: {
    color: colors.mutedForeground,
    fontSize: '0.75rem',
    fontWeight: 500,
    lineHeight: '1rem',
    paddingBlock: '0.375rem',
    paddingInline: '0.5rem',
  },
  list: {
    boxSizing: 'border-box',
    padding: '0.25rem',
  },
  scrollButton: {
    alignItems: 'center',
    backgroundColor: colors.popover,
    cursor: 'default',
    display: 'flex',
    justifyContent: 'center',
    paddingBlock: '0.25rem',
    position: 'relative',
    width: '100%',
    zIndex: 10,
  },
  scrollButtonDown: {
    bottom: 0,
  },
  scrollButtonUp: {
    top: 0,
  },
  separator: {
    backgroundColor: colors.border,
    height: '1px',
    marginBlock: '0.25rem',
    marginInline: '-0.25rem',
    pointerEvents: 'none',
  },
  trigger: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: {
      ':focus-visible': colors.ring,
      default: colors.input,
    },
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: {
      ':focus-visible': `0 0 0 1px ${colors.ring}`,
      default: null,
    },
    boxSizing: 'border-box',
    // A <button> does not inherit `color`: without this it falls back to the
    // UA `buttontext` (black), which stays black in dark mode.
    color: colors.foreground,
    cursor: {
      ':disabled': 'not-allowed',
      default: 'pointer',
    },
    display: 'flex',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    gap: '0.375rem',
    justifyContent: 'space-between',
    lineHeight: '1.25rem',
    opacity: {
      ':disabled': 0.5,
      default: 1,
    },
    outline: 'none',
    paddingLeft: '1rem',
    paddingRight: '0.75rem',
    pointerEvents: {
      ':disabled': 'none',
      default: null,
    },
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '150ms',
    },
    transitionProperty: 'color, background-color, border-color, box-shadow',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    width: '100%',
  },
  triggerAriaInvalid: {
    borderColor: colors.destructive,
    boxShadow: {
      ':focus-visible': `0 0 0 1px ${colors.ring}`,
      default: `0 0 0 3px color-mix(in oklab, ${colors.destructive} 20%, transparent)`,
    },
  },
  // 40px pill, the same height as Input.
  triggerDefault: {
    height: '2.5rem',
  },
  triggerIcon: {
    color: colors.mutedForeground,
    flexShrink: 0,
    height: '1rem',
    pointerEvents: 'none',
    width: '1rem',
  },
  // 28px pill, the same height as Button.
  triggerSm: {
    height: '1.75rem',
    paddingLeft: '0.75rem',
    paddingRight: '0.5rem',
  },
  value: {
    color: {
      ':is([data-placeholder])': colors.mutedForeground,
      default: colors.foreground,
    },
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    textAlign: 'left',
    textOverflow: 'ellipsis',
  },
});

const Select = SelectPrimitive.Root;

type SelectProps<
  Value = unknown,
  Multiple extends boolean | undefined = boolean | undefined,
> = SelectPrimitive.Root.Props<Value, Multiple>;

type SelectGroupProps = Omit<SelectPrimitive.Group.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const SelectGroup = ({ className, style, ...props }: SelectGroupProps) => (
  <SelectPrimitive.Group
    data-slot="select-group"
    {...stylexProps(styles.group, customClassName(className), style)}
    {...props}
  />
);

type SelectValueProps = Omit<SelectPrimitive.Value.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const SelectValue = ({ className, style, ...props }: SelectValueProps) => (
  <SelectPrimitive.Value
    data-slot="select-value"
    {...stylexProps(styles.value, customClassName(className), style)}
    {...props}
  />
);

type SelectTriggerProps = Omit<SelectPrimitive.Trigger.Props, 'className' | 'style'> & {
  className?: string | undefined;
  size?: 'sm' | 'default' | undefined;
  style?: StyleXStyles | undefined;
};

const SelectTrigger = ({
  children,
  className,
  size = 'default',
  style,
  ...props
}: SelectTriggerProps) => {
  // Same check as Input: every aria-invalid value except false ("grammar",
  // "spelling") marks the trigger invalid.
  const isInvalid = Boolean(props['aria-invalid']) && props['aria-invalid'] !== 'false';

  return (
    <SelectPrimitive.Trigger
      data-size={size}
      data-slot="select-trigger"
      {...stylexProps(
        styles.trigger,
        size === 'sm' ? styles.triggerSm : styles.triggerDefault,
        isInvalid && styles.triggerAriaInvalid,
        customClassName(className),
        style,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon render={<ChevronDownIcon {...stylexProps(styles.triggerIcon)} />} />
    </SelectPrimitive.Trigger>
  );
};

type SelectScrollUpButtonProps = Omit<
  ComponentProps<typeof SelectPrimitive.ScrollUpArrow>,
  'className' | 'style'
> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const SelectScrollUpButton = ({ className, style, ...props }: SelectScrollUpButtonProps) => (
  <SelectPrimitive.ScrollUpArrow
    data-slot="select-scroll-up-button"
    {...stylexProps(styles.scrollButton, styles.scrollButtonUp, customClassName(className), style)}
    {...props}
  >
    <ChevronUpIcon {...stylexProps(styles.icon)} />
  </SelectPrimitive.ScrollUpArrow>
);

type SelectScrollDownButtonProps = Omit<
  ComponentProps<typeof SelectPrimitive.ScrollDownArrow>,
  'className' | 'style'
> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const SelectScrollDownButton = ({ className, style, ...props }: SelectScrollDownButtonProps) => (
  <SelectPrimitive.ScrollDownArrow
    data-slot="select-scroll-down-button"
    {...stylexProps(
      styles.scrollButton,
      styles.scrollButtonDown,
      customClassName(className),
      style,
    )}
    {...props}
  >
    <ChevronDownIcon {...stylexProps(styles.icon)} />
  </SelectPrimitive.ScrollDownArrow>
);

type SelectContentProps = Omit<SelectPrimitive.Popup.Props, 'className' | 'style'> &
  Partial<
    Pick<
      SelectPrimitive.Positioner.Props,
      'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'
    >
  > & {
    className?: string | undefined;
    style?: StyleXStyles | undefined;
  };

const SelectContent = ({
  align = 'center',
  alignItemWithTrigger = true,
  alignOffset = 0,
  children,
  className,
  side = 'bottom',
  sideOffset = 4,
  style,
  ...props
}: SelectContentProps) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Positioner
      align={align}
      alignItemWithTrigger={alignItemWithTrigger}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...stylexProps(popupStyles.positioner)}
    >
      <SelectPrimitive.Popup
        className={(state) =>
          stylexProps(
            popupStyles.surface,
            styles.content,
            !alignItemWithTrigger && isHidden(state.transitionStatus) && popupStyles.hidden,
            customClassName(className),
            style,
          ).className
        }
        data-align-trigger={alignItemWithTrigger}
        data-slot="select-content"
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.List {...stylexProps(styles.list)}>{children}</SelectPrimitive.List>
        <SelectScrollDownButton />
      </SelectPrimitive.Popup>
    </SelectPrimitive.Positioner>
  </SelectPrimitive.Portal>
);

type SelectLabelProps = Omit<SelectPrimitive.GroupLabel.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const SelectLabel = ({ className, style, ...props }: SelectLabelProps) => (
  <SelectPrimitive.GroupLabel
    data-slot="select-label"
    {...stylexProps(styles.label, customClassName(className), style)}
    {...props}
  />
);

type SelectItemProps = Omit<SelectPrimitive.Item.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const SelectItem = ({ children, className, style, ...props }: SelectItemProps) => (
  <SelectPrimitive.Item
    className={(state) =>
      stylexProps(
        styles.item,
        state.highlighted && styles.itemHighlighted,
        state.disabled && styles.itemDisabled,
        customClassName(className),
        style,
      ).className
    }
    data-slot="select-item"
    {...props}
  >
    <SelectPrimitive.ItemText {...stylexProps(styles.itemText)}>
      {children}
    </SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator
      render={
        <span {...stylexProps(styles.itemIndicator)}>
          <CheckIcon {...stylexProps(styles.icon)} />
        </span>
      }
    />
  </SelectPrimitive.Item>
);

type SelectSeparatorProps = Omit<SelectPrimitive.Separator.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const SelectSeparator = ({ className, style, ...props }: SelectSeparatorProps) => (
  <SelectPrimitive.Separator
    data-slot="select-separator"
    {...stylexProps(styles.separator, customClassName(className), style)}
    {...props}
  />
);

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  styles as selectStyles,
};

export type {
  SelectContentProps,
  SelectGroupProps,
  SelectItemProps,
  SelectLabelProps,
  SelectProps,
  SelectScrollDownButtonProps,
  SelectScrollUpButtonProps,
  SelectSeparatorProps,
  SelectTriggerProps,
  SelectValueProps,
};
