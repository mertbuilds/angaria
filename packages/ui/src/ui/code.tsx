'use client';

import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { ComponentProps } from 'react';
import { optional } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';
import { font } from '../tokens.stylex.ts';

const styles = create({
  root: {
    backgroundColor: optional.codeBackground,
    borderRadius: '4px',
    boxDecorationBreak: 'clone',
    color: 'inherit',
    fontFamily: font.mono,
    fontSize: '0.875em',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 400,
    overflowWrap: 'anywhere',
    paddingBlock: '0.125em',
    paddingInline: '0.375em',
  },
});

/**
 * A technical value inside text: an address, a port, a path, a tool name, a
 * config key, a command. The system's mono, a size smaller than the text
 * around it, on a faint chip (`--code-background` tunes it).
 */
export function Code({
  className,
  style,
  ...props
}: Omit<ComponentProps<'code'>, 'style'> & { style?: StyleXStyles }) {
  return (
    <code
      translate="no"
      {...props}
      {...stylexProps(styles.root, customClassName(className), style)}
    />
  );
}
