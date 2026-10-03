'use client';

import type { Button as ButtonPrimitive } from '@base-ui/react/button';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { MouseEvent } from 'react';
import { capText } from '../lib/cap-text.tsx';
import { colors, optional, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';

const styles = create({
  base: {
    // Single height: 28px pill. The ::before pseudo-element extends the hit
    // area to ~40px without visual bulk.
    '::before': {
      content: '',
      inset: '-6px',
      position: 'absolute',
    },
    alignItems: 'center',
    backgroundClip: 'padding-box',
    borderRadius: radius.full,
    borderStyle: 'none',
    borderWidth: 0,
    boxSizing: 'border-box',
    cursor: {
      ':disabled': 'not-allowed',
      default: 'pointer',
    },
    display: 'inline-flex',
    flexShrink: 0,
    fontFamily: 'inherit',
    fontSize: '0.8rem',
    fontWeight: 500,
    gap: '0.25rem',
    height: '1.75rem',
    justifyContent: 'center',
    opacity: {
      ':disabled': 0.5,
      default: 1,
    },
    // A 2px ring 2px off the control: visible on a fill of the ring's own color.
    outlineColor: colors.ring,
    outlineOffset: '2px',
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: '2px',
    paddingInline: '0.875rem',
    pointerEvents: {
      ':disabled': 'none',
      default: null,
    },
    position: 'relative',
    // Tactile press feedback; the CSS transition stays interruptible.
    scale: {
      ':active': '0.96',
      default: '1',
    },
    // Buttons often render as <a> via the `render` prop: no anchor underline.
    textDecorationLine: 'none',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '150ms',
    },
    // Never `all`: list only what actually animates.
    transitionProperty: 'scale, background-color, border-color, color, box-shadow, opacity',
    transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  default: {
    backgroundColor: {
      ':hover': `color-mix(in oklab, ${colors.primary} 80%, transparent)`,
      default: colors.primary,
    },
    color: colors.primaryForeground,
  },
  destructive: {
    backgroundColor: {
      ':hover': `color-mix(in oklab, ${colors.destructive} 20%, transparent)`,
      default: `color-mix(in oklab, ${colors.destructive} 10%, transparent)`,
    },
    color: colors.destructive,
  },
  // A link-rendered Button has no :disabled state, so it gets the same look
  // from a style applied in render.
  disabledLink: {
    opacity: 0.5,
    pointerEvents: 'none',
  },
  ghost: {
    backgroundColor: {
      ':hover': colors.muted,
      default: 'transparent',
    },
    color: {
      ':hover': colors.foreground,
      default: 'inherit',
    },
  },
  icon: {
    paddingInline: 0,
    width: '1.75rem',
  },
  link: {
    backgroundColor: 'transparent',
    color: optional.primaryInk,
    textDecorationLine: {
      ':hover': 'underline',
      default: 'none',
    },
    textUnderlineOffset: '4px',
  },
  outline: {
    backgroundColor: {
      ':hover': colors.muted,
      default: 'transparent',
    },
    borderColor: colors.border,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: {
      ':hover': colors.foreground,
      default: 'inherit',
    },
  },
  secondary: {
    backgroundColor: {
      ':hover': `color-mix(in oklch, ${colors.secondary}, ${colors.foreground} 5%)`,
      default: colors.secondary,
    },
    color: colors.secondaryForeground,
  },
});

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';

/** `default` is the 28px pill; `icon` is the same height, square. */
export type ButtonSize = 'default' | 'icon';

const variantStyles: Record<ButtonVariant, StyleXStyles> = {
  default: styles.default,
  destructive: styles.destructive,
  ghost: styles.ghost,
  link: styles.link,
  outline: styles.outline,
  secondary: styles.secondary,
};

export type ButtonProps = Omit<ButtonPrimitive.Props, 'className' | 'style'> & {
  className?: string | undefined;
  size?: ButtonSize | undefined;
  style?: StyleXStyles | undefined;
  variant?: ButtonVariant | undefined;
};

// A link has no native disabled state: take it out of the tab order and cancel
// activation in the capture phase, before any onClick (including a router
// Link's own navigation handler) runs.
const disabledLinkProps = {
  'aria-disabled': true,
  onClickCapture: (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  },
  tabIndex: -1,
};

const Button = ({
  children,
  className,
  disabled = false,
  // A button that is disabled while its own request runs keeps the focus:
  // a natively disabled button drops it to the page.
  focusableWhenDisabled = false,
  render,
  // Without a `render` prop this is a <button>; with one, pass
  // `nativeButton` when the rendered element is still a <button>.
  nativeButton = render === undefined,
  size = 'default',
  style,
  variant = 'default',
  ...restProps
}: ButtonProps) => {
  const styleProps = stylexProps(
    styles.base,
    variantStyles[variant],
    size === 'icon' && styles.icon,
    disabled && (!nativeButton || focusableWhenDisabled) && styles.disabledLink,
    customClassName(className),
    style,
  );

  let elementProps;
  if (nativeButton) {
    // Never submit a surrounding form by accident, also when `render` swaps in
    // another <button>; an explicit `type` in restProps still wins.
    elementProps =
      disabled && focusableWhenDisabled
        ? { ...disabledLinkProps, tabIndex: undefined, type: 'button' as const }
        : { disabled, type: 'button' as const };
  } else if (disabled) {
    elementProps = disabledLinkProps;
  }

  return useRender({
    defaultTagName: 'button',
    props: mergeProps(
      {
        className: styleProps.className,
        'data-size': size,
        'data-slot': 'button',
        'data-variant': variant,
        style: styleProps.style,
      },
      elementProps,
      restProps,
      // Labels center on their cap height, like the icons beside them.
      children === undefined ? undefined : { children: capText(children) },
    ),
    render,
    state: {
      disabled,
      slot: 'button' as const,
      variant,
    },
  });
};

export { Button, styles as buttonStyles };
