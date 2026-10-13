'use client';

import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { ComponentProps } from 'react';
import { optional } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';
import { font, radius, spacing } from '../tokens.stylex.ts';

const styles = create({
  block: {
    backgroundColor: optional.codeBackground,
    borderRadius: radius.base,
    color: 'inherit',
    fontFamily: font.mono,
    fontSize: font.sizeXs,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 400,
    lineHeight: 1.5,
    margin: 0,
    minWidth: 0,
    overflowWrap: 'anywhere',
    paddingBlock: spacing.s2,
    paddingInline: spacing.s3,
    whiteSpace: 'pre-wrap',
  },
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

/**
 * Lines of a technical value: JSON, a config snippet. Code's mono and chip on
 * a block that keeps line breaks and indents and wraps long lines, so it
 * never scrolls sideways.
 */
export function CodeBlock({
  className,
  style,
  ...props
}: Omit<ComponentProps<'pre'>, 'style'> & { style?: StyleXStyles }) {
  return (
    <pre
      translate="no"
      {...props}
      {...stylexProps(styles.block, customClassName(className), style)}
    />
  );
}
