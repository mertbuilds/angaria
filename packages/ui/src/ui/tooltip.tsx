'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { isHidden, popupStyles } from '../lib/popup.ts';
import { colors, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';
import { motion } from '../tokens.stylex.ts';

const styles = create({
  popup: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    boxSizing: 'border-box',
    color: colors.primaryForeground,
    display: 'inline-flex',
    fontSize: '0.75rem',
    gap: '0.375rem',
    lineHeight: '1rem',
    maxWidth: '20rem',
    opacity: 1,
    outline: 'none',
    paddingBlock: '0.375rem',
    paddingInline: '0.625rem',
    textWrap: 'balance',
    transform: 'scale(1)',
    transformOrigin: 'var(--transform-origin)',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': `${motion.fade}, 0s`,
      default: `${motion.fade}, ${motion.move}`,
    },
    transitionProperty: 'opacity, transform',
    transitionTimingFunction: motion.ease,
    width: 'fit-content',
  },
});

type TooltipProviderProps = TooltipPrimitive.Provider.Props;

/** Wrap a toolbar (or the app) so neighboring tooltips open without delay. */
const TooltipProvider = ({ delay = 300, ...props }: TooltipProviderProps) => (
  <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />
);

type TooltipProps = TooltipPrimitive.Root.Props;

const Tooltip = (props: TooltipProps) => <TooltipPrimitive.Root data-slot="tooltip" {...props} />;

type TooltipTriggerProps = TooltipPrimitive.Trigger.Props;

const TooltipTrigger = (props: TooltipTriggerProps) => (
  <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
);

type TooltipContentProps = Omit<TooltipPrimitive.Popup.Props, 'className' | 'style'> &
  Partial<
    Pick<TooltipPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>
  > & {
    className?: string | undefined;
    style?: StyleXStyles | undefined;
  };

const TooltipContent = ({
  align = 'center',
  alignOffset = 0,
  className,
  side = 'top',
  sideOffset = 6,
  style,
  ...props
}: TooltipContentProps) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Positioner
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...stylexProps(popupStyles.positioner)}
    >
      <TooltipPrimitive.Popup
        className={(state) =>
          stylexProps(
            styles.popup,
            isHidden(state.transitionStatus) && popupStyles.hidden,
            customClassName(className),
            style,
          ).className
        }
        data-slot="tooltip-content"
        {...props}
      />
    </TooltipPrimitive.Positioner>
  </TooltipPrimitive.Portal>
);

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };

export type { TooltipContentProps, TooltipProps, TooltipProviderProps, TooltipTriggerProps };
