'use client';

import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';
import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { ComponentProps } from 'react';
import { customClassName } from '../lib/utils.stylex.ts';
import { Button } from './button.tsx';
import type { ButtonProps } from './button.tsx';
import { dialogStyles } from './dialog.tsx';

// Same surface, motion and parts as Dialog; an alert dialog only differs in
// behavior (no outside-click dismiss) and in having no close button.
const styles = create({
  contentSm: {
    maxWidth: '20rem',
  },
});

type AlertDialogProps = AlertDialogPrimitive.Root.Props;

const AlertDialog = (props: AlertDialogProps) => (
  <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
);

type AlertDialogTriggerProps = AlertDialogPrimitive.Trigger.Props;

const AlertDialogTrigger = (props: AlertDialogTriggerProps) => (
  <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
);

type AlertDialogContentProps = Omit<AlertDialogPrimitive.Popup.Props, 'className' | 'style'> & {
  className?: string | undefined;
  size?: 'default' | 'sm' | undefined;
  style?: StyleXStyles | undefined;
};

const AlertDialogContent = ({
  children,
  className,
  size = 'default',
  style,
  ...props
}: AlertDialogContentProps) => (
  <AlertDialogPrimitive.Portal>
    <AlertDialogPrimitive.Backdrop
      className={(state) =>
        stylexProps(
          dialogStyles.overlay,
          state.open ? dialogStyles.overlayOpen : dialogStyles.overlayClosed,
        ).className
      }
      data-slot="alert-dialog-overlay"
    />
    <AlertDialogPrimitive.Popup
      className={(state) =>
        stylexProps(
          dialogStyles.content,
          size === 'sm' && styles.contentSm,
          state.open ? dialogStyles.contentOpen : dialogStyles.contentClosed,
          customClassName(className),
          style,
        ).className
      }
      data-size={size}
      data-slot="alert-dialog-content"
      {...props}
    >
      <div data-slot="alert-dialog-body" {...stylexProps(dialogStyles.body)}>
        {children}
      </div>
    </AlertDialogPrimitive.Popup>
  </AlertDialogPrimitive.Portal>
);

type AlertDialogPartProps = Omit<ComponentProps<'div'>, 'style'> & {
  style?: StyleXStyles | undefined;
};

const AlertDialogHeader = ({ className, style, ...props }: AlertDialogPartProps) => (
  <div
    data-slot="alert-dialog-header"
    {...stylexProps(dialogStyles.header, customClassName(className), style)}
    {...props}
  />
);

const AlertDialogFooter = ({ className, style, ...props }: AlertDialogPartProps) => (
  <div
    data-slot="alert-dialog-footer"
    {...stylexProps(dialogStyles.footer, customClassName(className), style)}
    {...props}
  />
);

type AlertDialogTitleProps = Omit<AlertDialogPrimitive.Title.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const AlertDialogTitle = ({ className, style, ...props }: AlertDialogTitleProps) => (
  <AlertDialogPrimitive.Title
    data-slot="alert-dialog-title"
    {...stylexProps(dialogStyles.title, customClassName(className), style)}
    {...props}
  />
);

type AlertDialogDescriptionProps = Omit<
  AlertDialogPrimitive.Description.Props,
  'className' | 'style'
> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const AlertDialogDescription = ({ className, style, ...props }: AlertDialogDescriptionProps) => (
  <AlertDialogPrimitive.Description
    data-slot="alert-dialog-description"
    {...stylexProps(dialogStyles.description, customClassName(className), style)}
    {...props}
  />
);

/** The confirming action. Close the dialog yourself once the action is done. */
const AlertDialogAction = (props: ButtonProps) => (
  <Button data-slot="alert-dialog-action" {...props} />
);

type AlertDialogCancelProps = Omit<AlertDialogPrimitive.Close.Props, 'className' | 'style'> &
  Pick<ButtonProps, 'className' | 'style' | 'variant'>;

const AlertDialogCancel = ({
  className,
  style,
  variant = 'outline',
  ...props
}: AlertDialogCancelProps) => (
  <AlertDialogPrimitive.Close
    data-slot="alert-dialog-cancel"
    render={<Button className={className} style={style} variant={variant} />}
    {...props}
  />
);

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
};

export type {
  AlertDialogCancelProps,
  AlertDialogContentProps,
  AlertDialogDescriptionProps,
  AlertDialogProps,
  AlertDialogTitleProps,
  AlertDialogTriggerProps,
};
