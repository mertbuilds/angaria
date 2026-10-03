'use client';

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { capText } from '../lib/cap-text.tsx';
import { popupMotion, popupStyles, useHeldPlacement } from '../lib/popup.ts';
import { colors, optional, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';
import { inputStyles } from './input.tsx';

const styles = create({
  chip: {
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    color: colors.secondaryForeground,
    display: 'inline-flex',
    fontSize: '0.75rem',
    gap: '0.25rem',
    height: '1.5rem',
    paddingInlineEnd: '0.25rem',
    paddingInlineStart: '0.625rem',
  },
  chipRemove: {
    alignItems: 'center',
    backgroundColor: { ':hover': colors.background, default: 'transparent' },
    borderRadius: radius.full,
    borderWidth: 0,
    color: colors.mutedForeground,
    cursor: 'pointer',
    display: 'inline-flex',
    height: '1rem',
    justifyContent: 'center',
    padding: 0,
    width: '1rem',
  },
  // Input's radius system: one row is a 40px pill, more rows keep its 20px
  // ends as a rounded rect.
  chips: {
    alignItems: 'center',
    backgroundColor: optional.inputBackground,
    borderColor: {
      ':focus-within': colors.ring,
      ':hover': { '@media (hover: hover)': optional.inputHover, default: null },
      default: colors.input,
    },
    borderRadius: '1.25rem',
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.25rem',
    minHeight: '2.5rem',
    paddingBlock: '0.375rem',
    paddingInline: '0.5rem',
    width: '100%',
  },
  chipsInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: colors.foreground,
    flex: 1,
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    minWidth: '4rem',
    outline: 'none',
    paddingInline: '0.375rem',
  },
  content: {
    maxHeight: 'min(var(--available-height), 20rem)',
    minWidth: 'var(--anchor-width)',
    overflowY: 'auto',
    padding: '0.25rem',
  },
  empty: {
    ':empty': {
      display: 'none',
    },
    color: colors.mutedForeground,
    fontSize: '0.875rem',
    paddingBlock: '1rem',
    textAlign: 'center',
  },
  groupLabel: {
    color: colors.mutedForeground,
    fontSize: '0.75rem',
    fontWeight: 500,
    paddingBlock: '0.375rem',
    paddingInline: '0.5rem',
  },
  // A 32px round target around the 16px icon, inside the 40px field.
  iconButton: {
    alignItems: 'center',
    backgroundColor: {
      ':hover': { '@media (hover: hover)': colors.accent, default: null },
      default: 'transparent',
    },
    borderRadius: radius.full,
    borderWidth: 0,
    color: {
      ':hover': { '@media (hover: hover)': colors.foreground, default: null },
      default: colors.mutedForeground,
    },
    cursor: 'pointer',
    display: 'inline-flex',
    height: '2rem',
    insetInlineEnd: '0.25rem',
    justifyContent: 'center',
    padding: 0,
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '2rem',
  },
  input: {
    paddingInlineEnd: '2.25rem',
  },
  inputWrap: {
    position: 'relative',
    width: '100%',
  },
  item: {
    alignItems: 'center',
    // Concentric with the 8px popup and its 4px padding.
    borderRadius: `calc(${radius.md} - 4px)`,
    color: colors.popoverForeground,
    cursor: 'default',
    display: 'flex',
    fontSize: '0.875rem',
    gap: '0.5rem',
    lineHeight: '1.25rem',
    outline: 'none',
    paddingBlock: '0.375rem',
    paddingInlineEnd: '2rem',
    paddingInlineStart: '0.5rem',
    position: 'relative',
    userSelect: 'none',
  },
  itemDisabled: {
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
    insetInlineEnd: '0.5rem',
    justifyContent: 'center',
    position: 'absolute',
    width: '1rem',
  },
  separator: {
    backgroundColor: colors.border,
    height: '1px',
    marginBlock: '0.25rem',
    marginInline: '-0.25rem',
  },
});

type StyleXOverrides = {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const TRIGGER_LABEL = 'Listeyi aç';
const CLEAR_LABEL = 'Temizle';

const Combobox = ComboboxPrimitive.Root;

const ComboboxValue = ComboboxPrimitive.Value;

const ComboboxCollection = ComboboxPrimitive.Collection;

type ComboboxTriggerProps = Omit<ComboboxPrimitive.Trigger.Props, 'className' | 'style'> &
  StyleXOverrides;

const ComboboxTrigger = ({ children, className, style, ...props }: ComboboxTriggerProps) => (
  <ComboboxPrimitive.Trigger
    aria-label={TRIGGER_LABEL}
    data-slot="combobox-trigger"
    {...stylexProps(styles.iconButton, customClassName(className), style)}
    {...props}
  >
    {children ?? <ChevronDownIcon size={16} />}
  </ComboboxPrimitive.Trigger>
);

type ComboboxClearProps = Omit<ComboboxPrimitive.Clear.Props, 'className' | 'style'> &
  StyleXOverrides;

const ComboboxClear = ({ children, className, style, ...props }: ComboboxClearProps) => (
  <ComboboxPrimitive.Clear
    aria-label={CLEAR_LABEL}
    data-slot="combobox-clear"
    {...stylexProps(styles.iconButton, customClassName(className), style)}
    {...props}
  >
    {children ?? <XIcon size={16} />}
  </ComboboxPrimitive.Clear>
);

type ComboboxInputProps = Omit<ComboboxPrimitive.Input.Props, 'className' | 'style'> &
  StyleXOverrides & {
    showClear?: boolean | undefined;
    showTrigger?: boolean | undefined;
  };

/** A 40px pill input, like Input, with a chevron (or clear) button at the end. */
const ComboboxInput = ({
  children,
  className,
  showClear = false,
  showTrigger = true,
  style,
  ...props
}: ComboboxInputProps) => (
  <div {...stylexProps(styles.inputWrap)}>
    <ComboboxPrimitive.Input
      data-slot="combobox-input"
      {...stylexProps(
        inputStyles.root,
        styles.input,
        Boolean(props['aria-invalid']) &&
          props['aria-invalid'] !== 'false' &&
          inputStyles.ariaInvalid,
        customClassName(className),
        style,
      )}
      {...props}
    />
    {children}
    {showClear ? <ComboboxClear /> : null}
    {showTrigger && !showClear ? <ComboboxTrigger /> : null}
  </div>
);

type ComboboxChipsProps = Omit<ComboboxPrimitive.Chips.Props, 'className' | 'style'> &
  StyleXOverrides;

const ComboboxChips = ({ className, style, ...props }: ComboboxChipsProps) => (
  <ComboboxPrimitive.Chips
    data-slot="combobox-chips"
    {...stylexProps(styles.chips, customClassName(className), style)}
    {...props}
  />
);

type ComboboxChipProps = Omit<ComboboxPrimitive.Chip.Props, 'className' | 'style'> &
  StyleXOverrides & {
    /** Accessible name of the remove button. */
    removeLabel?: string | undefined;
    showRemove?: boolean | undefined;
  };

const ComboboxChip = ({
  children,
  className,
  removeLabel = 'Kaldır',
  showRemove = true,
  style,
  ...props
}: ComboboxChipProps) => (
  <ComboboxPrimitive.Chip
    data-slot="combobox-chip"
    {...stylexProps(styles.chip, customClassName(className), style)}
    {...props}
  >
    {capText(children)}
    {showRemove ? (
      <ComboboxPrimitive.ChipRemove
        aria-label={removeLabel}
        data-slot="combobox-chip-remove"
        {...stylexProps(styles.chipRemove)}
      >
        <XIcon size={12} />
      </ComboboxPrimitive.ChipRemove>
    ) : null}
  </ComboboxPrimitive.Chip>
);

type ComboboxChipsInputProps = Omit<ComboboxPrimitive.Input.Props, 'className' | 'style'> &
  StyleXOverrides;

const ComboboxChipsInput = ({ className, style, ...props }: ComboboxChipsInputProps) => (
  <ComboboxPrimitive.Input
    data-slot="combobox-chips-input"
    {...stylexProps(styles.chipsInput, customClassName(className), style)}
    {...props}
  />
);

type ComboboxContentProps = Omit<ComboboxPrimitive.Popup.Props, 'className' | 'style'> &
  Partial<
    Pick<
      ComboboxPrimitive.Positioner.Props,
      'align' | 'alignOffset' | 'anchor' | 'side' | 'sideOffset'
    >
  > &
  StyleXOverrides;

const ComboboxContent = ({
  align = 'start',
  alignOffset = 0,
  anchor,
  className,
  side = 'bottom',
  sideOffset = 4,
  style,
  ...props
}: ComboboxContentProps) => {
  const placement = useHeldPlacement(side, align);
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        alignOffset={alignOffset}
        anchor={anchor}
        sideOffset={sideOffset}
        {...placement}
        {...stylexProps(popupStyles.positioner)}
      >
        <ComboboxPrimitive.Popup
          className={(state) =>
            stylexProps(
              popupStyles.surface,
              styles.content,
              popupMotion(state.transitionStatus),
              customClassName(className),
              style,
            ).className
          }
          data-slot="combobox-content"
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
};

type ComboboxListProps = Omit<ComboboxPrimitive.List.Props, 'className' | 'style'> &
  StyleXOverrides;

const ComboboxList = ({ className, style, ...props }: ComboboxListProps) => (
  <ComboboxPrimitive.List
    data-slot="combobox-list"
    {...stylexProps(customClassName(className), style)}
    {...props}
  />
);

type ComboboxItemProps = Omit<ComboboxPrimitive.Item.Props, 'className' | 'style'> &
  StyleXOverrides;

const ComboboxItem = ({ children, className, style, ...props }: ComboboxItemProps) => (
  <ComboboxPrimitive.Item
    className={(state) =>
      stylexProps(
        styles.item,
        state.highlighted && styles.itemHighlighted,
        state.disabled && styles.itemDisabled,
        customClassName(className),
        style,
      ).className
    }
    data-slot="combobox-item"
    {...props}
  >
    {capText(children)}
    <ComboboxPrimitive.ItemIndicator {...stylexProps(styles.itemIndicator)}>
      <CheckIcon size={16} />
    </ComboboxPrimitive.ItemIndicator>
  </ComboboxPrimitive.Item>
);

const ComboboxGroup = (props: ComboboxPrimitive.Group.Props) => (
  <ComboboxPrimitive.Group data-slot="combobox-group" {...props} />
);

type ComboboxGroupLabelProps = Omit<ComboboxPrimitive.GroupLabel.Props, 'className' | 'style'> &
  StyleXOverrides;

const ComboboxGroupLabel = ({ className, style, ...props }: ComboboxGroupLabelProps) => (
  <ComboboxPrimitive.GroupLabel
    data-slot="combobox-group-label"
    {...stylexProps(styles.groupLabel, customClassName(className), style)}
    {...props}
  />
);

type ComboboxEmptyProps = Omit<ComboboxPrimitive.Empty.Props, 'className' | 'style'> &
  StyleXOverrides;

const ComboboxEmpty = ({ className, style, ...props }: ComboboxEmptyProps) => (
  <ComboboxPrimitive.Empty
    data-slot="combobox-empty"
    {...stylexProps(styles.empty, customClassName(className), style)}
    {...props}
  />
);

type ComboboxSeparatorProps = Omit<ComponentProps<'div'>, 'style'> & {
  style?: StyleXStyles | undefined;
};

const ComboboxSeparator = ({ className, style, ...props }: ComboboxSeparatorProps) => (
  <div
    data-slot="combobox-separator"
    role="separator"
    {...stylexProps(styles.separator, customClassName(className), style)}
    {...props}
  />
);

export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxClear,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
};

export type {
  ComboboxChipProps,
  ComboboxContentProps,
  ComboboxInputProps,
  ComboboxItemProps,
  ComboboxTriggerProps,
};
