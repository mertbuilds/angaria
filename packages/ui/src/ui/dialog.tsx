'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { create, keyframes, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { XIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { colors, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';
import { motion } from '../tokens.stylex.ts';
import { Button } from './button.tsx';

const fadeIn = keyframes({
  '0%': { opacity: 0 },
  '100%': { opacity: 1 },
});

const fadeOut = keyframes({
  '0%': { opacity: 1 },
  '100%': { opacity: 0 },
});

const zoomIn = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translate(-50%, -50%) scale(0.96)',
  },
  '100%': {
    opacity: 1,
    transform: 'translate(-50%, -50%) scale(1)',
  },
});

const zoomOut = keyframes({
  '0%': {
    opacity: 1,
    transform: 'translate(-50%, -50%) scale(1)',
  },
  '100%': {
    opacity: 0,
    transform: 'translate(-50%, -50%) scale(0.96)',
  },
});

const styles = create({
  body: {
    display: 'grid',
    gap: '1rem',
    // One column as wide as the dialog: long content wraps or shrinks instead
    // of widening the column and scrolling sideways.
    gridTemplateColumns: 'minmax(0, 1fr)',
    // Long content scrolls here, not on the popup, so the close button (a
    // sibling) stays in place.
    minHeight: 0,
    overflowY: 'auto',
    padding: '1rem',
  },
  closeButton: {
    position: 'absolute',
    right: '0.5rem',
    top: '0.5rem',
  },
  content: {
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
    display: 'flex',
    flexDirection: 'column',
    fontSize: '0.875rem',
    left: '50%',
    lineHeight: '1.25rem',
    // Capped at the viewport; the body shrinks to fit and scrolls instead.
    maxHeight: 'calc(100dvh - 2rem)',
    maxWidth: {
      '@media (min-width: 640px)': '28rem',
      default: 'calc(100% - 2rem)',
    },
    outline: 'none',
    overflow: 'hidden',
    position: 'fixed',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '100%',
    zIndex: 50,
  },
  // Wide content (lists to choose from, long text).
  contentLarge: {
    maxWidth: {
      '@media (min-width: 640px)': '42rem',
      default: 'calc(100% - 2rem)',
    },
  },
  // A close gets out of the way: quicker than the open.
  contentClosed: {
    animationDuration: '150ms',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': fadeOut,
      default: zoomOut,
    },
  },
  contentOpen: {
    animationName: {
      '@media (prefers-reduced-motion: reduce)': fadeIn,
      default: zoomIn,
    },
  },
  description: {
    color: colors.mutedForeground,
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    margin: 0,
  },
  footer: {
    backgroundColor: colors.muted,
    borderTopColor: colors.border,
    borderTopStyle: 'solid',
    borderTopWidth: '1px',
    display: 'flex',
    flexDirection: {
      '@media (min-width: 640px)': 'row',
      default: 'column-reverse',
    },
    gap: '0.5rem',
    justifyContent: {
      '@media (min-width: 640px)': 'flex-end',
      default: 'flex-start',
    },
    marginBottom: '-1rem',
    marginInline: '-1rem',
    padding: '1rem',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  overlay: {
    animationDuration: motion.fade,
    animationFillMode: 'forwards',
    backgroundColor: 'color-mix(in oklab, black 20%, transparent)',
    inset: 0,
    isolation: 'isolate',
    position: 'fixed',
    zIndex: 50,
  },
  overlayClosed: {
    animationDuration: '150ms',
    animationName: fadeOut,
  },
  overlayOpen: {
    animationName: fadeIn,
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
  title: {
    fontFamily: 'inherit',
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: 1.25,
    margin: 0,
  },
});

export type DialogProps = DialogPrimitive.Root.Props;

const Dialog = (props: DialogProps) => <DialogPrimitive.Root data-slot="dialog" {...props} />;

export type DialogTriggerProps = DialogPrimitive.Trigger.Props;

const DialogTrigger = (props: DialogTriggerProps) => (
  <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
);

export type DialogPortalProps = DialogPrimitive.Portal.Props;

const DialogPortal = (props: DialogPortalProps) => (
  <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
);

export type DialogCloseProps = DialogPrimitive.Close.Props;

const DialogClose = (props: DialogCloseProps) => (
  <DialogPrimitive.Close data-slot="dialog-close" {...props} />
);

export type DialogOverlayProps = Omit<DialogPrimitive.Backdrop.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const DialogOverlay = ({ className, style, ...props }: DialogOverlayProps) => (
  <DialogPrimitive.Backdrop
    className={(state) =>
      stylexProps(
        styles.overlay,
        state.open ? styles.overlayOpen : styles.overlayClosed,
        customClassName(className),
        style,
      ).className
    }
    data-slot="dialog-overlay"
    {...props}
  />
);

export type DialogContentProps = Omit<DialogPrimitive.Popup.Props, 'className' | 'style'> & {
  className?: string | undefined;
  /** Accessible name of the close button. */
  closeLabel?: string | undefined;
  showCloseButton?: boolean | undefined;
  /** default: 28rem wide; lg: 42rem, for lists to choose from and long text. */
  size?: 'default' | 'lg' | undefined;
  style?: StyleXStyles | undefined;
};

const DialogContent = ({
  children,
  className,
  closeLabel = 'Kapat',
  showCloseButton = true,
  size = 'default',
  style,
  ...props
}: DialogContentProps) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Popup
      className={(state) =>
        stylexProps(
          styles.content,
          size === 'lg' && styles.contentLarge,
          state.open ? styles.contentOpen : styles.contentClosed,
          customClassName(className),
          style,
        ).className
      }
      data-slot="dialog-content"
      {...props}
    >
      <div data-slot="dialog-body" {...stylexProps(styles.body)}>
        {children}
      </div>
      {showCloseButton && (
        <DialogPrimitive.Close
          data-slot="dialog-close"
          render={
            <Button size="icon" style={styles.closeButton} variant="ghost">
              <XIcon size={16} />
              <span {...stylexProps(styles.srOnly)}>{closeLabel}</span>
            </Button>
          }
        />
      )}
    </DialogPrimitive.Popup>
  </DialogPortal>
);

export type DialogHeaderProps = Omit<ComponentProps<'div'>, 'style'> & {
  style?: StyleXStyles | undefined;
};

const DialogHeader = ({ className, style, ...props }: DialogHeaderProps) => (
  <div
    data-slot="dialog-header"
    {...stylexProps(styles.header, customClassName(className), style)}
    {...props}
  />
);

export type DialogFooterProps = Omit<ComponentProps<'div'>, 'style'> & {
  closeLabel?: string | undefined;
  showCloseButton?: boolean | undefined;
  style?: StyleXStyles | undefined;
};

const DialogFooter = ({
  children,
  className,
  closeLabel = 'Kapat',
  showCloseButton = false,
  style,
  ...props
}: DialogFooterProps) => (
  <div
    data-slot="dialog-footer"
    {...stylexProps(styles.footer, customClassName(className), style)}
    {...props}
  >
    {children}
    {showCloseButton && (
      <DialogPrimitive.Close render={<Button variant="outline">{closeLabel}</Button>} />
    )}
  </div>
);

export type DialogTitleProps = Omit<DialogPrimitive.Title.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const DialogTitle = ({ className, style, ...props }: DialogTitleProps) => (
  <DialogPrimitive.Title
    data-slot="dialog-title"
    {...stylexProps(styles.title, customClassName(className), style)}
    {...props}
  />
);

export type DialogDescriptionProps = Omit<
  DialogPrimitive.Description.Props,
  'className' | 'style'
> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const DialogDescription = ({ className, style, ...props }: DialogDescriptionProps) => (
  <DialogPrimitive.Description
    data-slot="dialog-description"
    {...stylexProps(styles.description, customClassName(className), style)}
    {...props}
  />
);

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  styles as dialogStyles,
};
