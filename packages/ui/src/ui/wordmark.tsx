'use client';

import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { ComponentProps } from 'react';
import { customClassName } from '../lib/utils.stylex.ts';

/** The brand is the word: always lowercase, never translated. */
const WORDMARK = 'angaria';

const styles = create({
  root: {
    color: 'inherit',
    display: 'inline-block',
    fontFamily: 'var(--font-sans)',
    // Inherits the size, so it scales with whatever text it sits in.
    fontSize: '1em',
    fontWeight: 500,
    letterSpacing: '-0.02em',
    lineHeight: 1,
    textTransform: 'lowercase',
    whiteSpace: 'nowrap',
  },
});

export type WordmarkProps = Omit<ComponentProps<'span'>, 'children' | 'style'> & {
  style?: StyleXStyles | undefined;
};

/** Lowercase `angaria` in Suisse Intl Medium. Size it with `style` (fontSize). */
const Wordmark = ({ className, style, ...props }: WordmarkProps) => (
  <span
    data-slot="wordmark"
    {...stylexProps(styles.root, customClassName(className), style)}
    {...props}
  >
    {WORDMARK}
  </span>
);

export { Wordmark };
