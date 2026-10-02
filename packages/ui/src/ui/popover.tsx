'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { ComponentProps } from 'react';
import { popupMotion, popupStyles, useHeldPlacement } from '../lib/popup.ts';
import { colors } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';

const styles = create({
  description: {
    color: colors.mutedForeground,
    fontFamily: 'inherit',
    margin: 0,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: '0.875rem',
    gap: '0.25rem',
  },
  popup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    padding: '0.75rem',
    width: '18rem',
  },
  title: {
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    fontWeight: 500,
    margin: 0,
  },
});

type PopoverProps = PopoverPrimitive.Root.Props;

const Popover = (props: PopoverProps) => <PopoverPrimitive.Root data-slot="popover" {...props} />;

type PopoverTriggerProps = PopoverPrimitive.Trigger.Props;

const PopoverTrigger = (props: PopoverTriggerProps) => (
  <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
);

type PopoverContentProps = Omit<PopoverPrimitive.Popup.Props, 'className' | 'style'> &
  Partial<
    Pick<PopoverPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>
  > & {
    className?: string | undefined;
    style?: StyleXStyles | undefined;
  };

const PopoverContent = ({
  align = 'center',
  alignOffset = 0,
  className,
  side = 'bottom',
  sideOffset = 4,
  style,
  ...props
}: PopoverContentProps) => {
  const placement = useHeldPlacement(side, align);
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        {...placement}
        {...stylexProps(popupStyles.positioner)}
      >
        <PopoverPrimitive.Popup
          className={(state) =>
            stylexProps(
              popupStyles.surface,
              styles.popup,
              popupMotion(state.transitionStatus),
              customClassName(className),
              style,
            ).className
          }
          data-slot="popover-content"
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
};

type PopoverHeaderProps = Omit<ComponentProps<'div'>, 'style'> & {
  style?: StyleXStyles | undefined;
};

const PopoverHeader = ({ className, style, ...props }: PopoverHeaderProps) => (
  <div
    data-slot="popover-header"
    {...stylexProps(styles.header, customClassName(className), style)}
    {...props}
  />
);

type PopoverTitleProps = Omit<PopoverPrimitive.Title.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const PopoverTitle = ({ className, style, ...props }: PopoverTitleProps) => (
  <PopoverPrimitive.Title
    data-slot="popover-title"
    {...stylexProps(styles.title, customClassName(className), style)}
    {...props}
  />
);

type PopoverDescriptionProps = Omit<PopoverPrimitive.Description.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const PopoverDescription = ({ className, style, ...props }: PopoverDescriptionProps) => (
  <PopoverPrimitive.Description
    data-slot="popover-description"
    {...stylexProps(styles.description, customClassName(className), style)}
    {...props}
  />
);

export { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger };

export type {
  PopoverContentProps,
  PopoverDescriptionProps,
  PopoverHeaderProps,
  PopoverProps,
  PopoverTitleProps,
  PopoverTriggerProps,
};
