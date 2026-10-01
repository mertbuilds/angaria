'use client';

import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { ComponentProps } from 'react';
import { colors } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';

const styles = create({
  group: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: '0.25rem',
  },
  root: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: '4px',
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.mutedForeground,
    display: 'inline-flex',
    fontFamily: 'inherit',
    fontSize: '0.75rem',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 500,
    gap: '0.25rem',
    height: '1.25rem',
    justifyContent: 'center',
    lineHeight: '1rem',
    minWidth: '1.25rem',
    paddingInline: '0.25rem',
    pointerEvents: 'none',
    userSelect: 'none',
    width: 'fit-content',
  },
});

export type KbdProps = Omit<ComponentProps<'kbd'>, 'style'> & {
  style?: StyleXStyles | undefined;
};

const Kbd = ({ className, style, ...props }: KbdProps) => (
  <kbd
    data-slot="kbd"
    {...stylexProps(styles.root, customClassName(className), style)}
    {...props}
  />
);

const KbdGroup = ({ className, style, ...props }: KbdProps) => (
  <kbd
    data-slot="kbd-group"
    {...stylexProps(styles.group, customClassName(className), style)}
    {...props}
  />
);

export { Kbd, KbdGroup };
