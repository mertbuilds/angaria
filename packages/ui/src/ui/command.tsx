'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { create, keyframes, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import {
  CommandEmpty as CmdkEmpty,
  CommandGroup as CmdkGroup,
  CommandInput as CmdkInput,
  CommandItem as CmdkItem,
  CommandList as CmdkList,
  CommandRoot as CmdkRoot,
  CommandSeparator as CmdkSeparator,
} from 'cmdk';
import { SearchIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { capText } from '../lib/cap-text.tsx';
import { colors, fontMetrics, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';
import { motion } from '../tokens.stylex.ts';
import { dialogStyles } from './dialog.tsx';
import { Kbd } from './kbd.tsx';

// The palette sits in the upper third of the window, so it opens and closes
// with its own keyframes rather than Dialog's centered ones.
const paletteIn = keyframes({
  '0%': { opacity: 0, transform: 'translateX(-50%) scale(0.98)' },
  '100%': { opacity: 1, transform: 'translateX(-50%) scale(1)' },
});

const paletteOut = keyframes({
  '0%': { opacity: 1, transform: 'translateX(-50%) scale(1)' },
  '100%': { opacity: 0, transform: 'translateX(-50%) scale(0.98)' },
});

const fadeIn = keyframes({
  '0%': { opacity: 0 },
  '100%': { opacity: 1 },
});

const fadeOut = keyframes({
  '0%': { opacity: 1 },
  '100%': { opacity: 0 },
});

const styles = create({
  dialog: {
    animationDuration: motion.move,
    animationFillMode: 'forwards',
    animationTimingFunction: motion.ease,
    backgroundColor: colors.popover,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.popoverForeground,
    left: '50%',
    maxWidth: 'calc(100% - 2rem)',
    outline: 'none',
    overflow: 'hidden',
    position: 'fixed',
    top: '20vh',
    transform: 'translateX(-50%)',
    width: '36rem',
    zIndex: 50,
  },
  dialogClosed: {
    animationName: {
      '@media (prefers-reduced-motion: reduce)': fadeOut,
      default: paletteOut,
    },
  },
  dialogOpen: {
    animationName: {
      '@media (prefers-reduced-motion: reduce)': fadeIn,
      default: paletteIn,
    },
  },
  empty: {
    color: colors.mutedForeground,
    fontSize: '0.875rem',
    paddingBlock: '1.5rem',
    textAlign: 'center',
  },
  group: {
    color: colors.foreground,
    overflow: 'hidden',
    padding: '0.25rem',
  },
  groupHeading: {
    color: colors.mutedForeground,
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 500,
    paddingBlock: '0.375rem',
    paddingInline: '0.5rem',
  },
  input: {
    '::placeholder': { color: colors.mutedForeground },
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: colors.foreground,
    flex: 1,
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    height: '2.75rem',
    minWidth: 0,
    outline: 'none',
    padding: 0,
    // The value's caps on the middle, level with the search icon.
    paddingTop: `calc(2 * ${fontMetrics.capOffset})`,
  },
  inputIcon: {
    color: colors.mutedForeground,
    flexShrink: 0,
    height: '1rem',
    width: '1rem',
  },
  inputWrapper: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomStyle: 'solid',
    borderBottomWidth: '1px',
    display: 'flex',
    gap: '0.5rem',
    paddingInline: '0.75rem',
  },
  item: {
    alignItems: 'center',
    backgroundColor: {
      ':is([data-selected=true])': colors.accent,
      default: 'transparent',
    },
    // Concentric with the 8px surface and the group's 4px padding.
    borderRadius: `calc(${radius.md} - 4px)`,
    color: {
      ':is([data-selected=true])': colors.accentForeground,
      default: 'inherit',
    },
    cursor: 'default',
    display: 'flex',
    fontSize: '0.875rem',
    gap: '0.5rem',
    lineHeight: '1.25rem',
    opacity: {
      ':is([data-disabled=true])': 0.5,
      default: 1,
    },
    outline: 'none',
    paddingBlock: '0.375rem',
    paddingInline: '0.5rem',
    pointerEvents: {
      ':is([data-disabled=true])': 'none',
      default: null,
    },
    position: 'relative',
    userSelect: 'none',
  },
  list: {
    maxHeight: '20rem',
    overflowX: 'hidden',
    overflowY: 'auto',
    scrollPaddingBlock: '0.25rem',
  },
  root: {
    backgroundColor: colors.popover,
    color: colors.popoverForeground,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    width: '100%',
  },
  separator: {
    backgroundColor: colors.border,
    height: '1px',
  },
  shortcut: {
    marginInlineStart: 'auto',
  },
  srOnly: {
    borderWidth: 0,
    clip: 'rect(0, 0, 0, 0)',
    height: '1px',
    margin: '-1px',
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: '1px',
  },
});

type StyleXOverrides = {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

type CommandProps = Omit<ComponentProps<typeof CmdkRoot>, 'className' | 'style'> & StyleXOverrides;

/** Filterable, keyboard-driven list (cmdk). Use inside CommandDialog for ⌘K. */
const Command = ({ className, style, ...props }: CommandProps) => (
  <CmdkRoot
    data-slot="command"
    {...stylexProps(styles.root, customClassName(className), style)}
    {...props}
  />
);

type CommandDialogProps = DialogPrimitive.Root.Props & {
  children?: ReactNode;
  /** Props for the inner Command (filtering, loop, value). */
  commandProps?: CommandProps | undefined;
  /** Screen reader description of the palette. */
  description?: string | undefined;
  /** Screen reader title of the palette. */
  title?: string | undefined;
};

const CommandDialog = ({
  children,
  commandProps,
  description = 'Bir komut ara ve çalıştır',
  title = 'Komut paleti',
  ...props
}: CommandDialogProps) => (
  <DialogPrimitive.Root data-slot="command-dialog" {...props}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        className={(state) =>
          stylexProps(
            dialogStyles.overlay,
            state.open ? dialogStyles.overlayOpen : dialogStyles.overlayClosed,
          ).className
        }
      />
      <DialogPrimitive.Popup
        className={(state) =>
          stylexProps(styles.dialog, state.open ? styles.dialogOpen : styles.dialogClosed).className
        }
        data-slot="command-dialog-content"
      >
        <DialogPrimitive.Title {...stylexProps(styles.srOnly)}>{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description {...stylexProps(styles.srOnly)}>
          {description}
        </DialogPrimitive.Description>
        <Command {...commandProps}>{children}</Command>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);

type CommandInputProps = Omit<ComponentProps<typeof CmdkInput>, 'className' | 'style'> &
  StyleXOverrides;

const CommandInput = ({ className, style, ...props }: CommandInputProps) => (
  <div data-slot="command-input-wrapper" {...stylexProps(styles.inputWrapper)}>
    <SearchIcon {...stylexProps(styles.inputIcon)} />
    <CmdkInput
      data-slot="command-input"
      {...stylexProps(styles.input, customClassName(className), style)}
      {...props}
    />
  </div>
);

type CommandListProps = Omit<ComponentProps<typeof CmdkList>, 'className' | 'style'> &
  StyleXOverrides;

const CommandList = ({ className, style, ...props }: CommandListProps) => (
  <CmdkList
    data-slot="command-list"
    {...stylexProps(styles.list, customClassName(className), style)}
    {...props}
  />
);

type CommandEmptyProps = Omit<ComponentProps<typeof CmdkEmpty>, 'className' | 'style'> &
  StyleXOverrides;

const CommandEmpty = ({ className, style, ...props }: CommandEmptyProps) => (
  <CmdkEmpty
    data-slot="command-empty"
    {...stylexProps(styles.empty, customClassName(className), style)}
    {...props}
  />
);

type CommandGroupProps = Omit<ComponentProps<typeof CmdkGroup>, 'className' | 'style'> &
  StyleXOverrides;

const CommandGroup = ({ className, heading, style, ...props }: CommandGroupProps) => (
  <CmdkGroup
    data-slot="command-group"
    heading={heading ? <span {...stylexProps(styles.groupHeading)}>{heading}</span> : undefined}
    {...stylexProps(styles.group, customClassName(className), style)}
    {...props}
  />
);

type CommandSeparatorProps = Omit<ComponentProps<typeof CmdkSeparator>, 'className' | 'style'> &
  StyleXOverrides;

const CommandSeparator = ({ className, style, ...props }: CommandSeparatorProps) => (
  <CmdkSeparator
    data-slot="command-separator"
    {...stylexProps(styles.separator, customClassName(className), style)}
    {...props}
  />
);

type CommandItemProps = Omit<ComponentProps<typeof CmdkItem>, 'className' | 'style'> &
  StyleXOverrides;

const CommandItem = ({ children, className, style, ...props }: CommandItemProps) => (
  <CmdkItem
    data-slot="command-item"
    {...stylexProps(styles.item, customClassName(className), style)}
    {...props}
  >
    {capText(children)}
  </CmdkItem>
);

/** A trailing key hint on a CommandItem, e.g. ⌘N. */
const CommandShortcut = ({ className, style, ...props }: ComponentProps<typeof Kbd>) => (
  <Kbd
    className={className}
    data-slot="command-shortcut"
    style={[styles.shortcut, style]}
    {...props}
  />
);

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};

export type {
  CommandDialogProps,
  CommandEmptyProps,
  CommandGroupProps,
  CommandInputProps,
  CommandItemProps,
  CommandListProps,
  CommandProps,
  CommandSeparatorProps,
};
