'use client';

import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import type { ComponentProps } from 'react';
import { capStyles } from '../lib/cap-text.tsx';
import { customClassName } from '../lib/utils.stylex.ts';

/** The brand is the word: always `Angaria` with a capital A, never translated. */
const WORDMARK = 'Angaria';

const styles = create({
  // The app's tile, a little taller than the caps, like a Mac app's sidebar.
  icon: {
    display: 'block',
    flexShrink: 0,
    height: '1.1em',
    width: '1.1em',
  },
  root: {
    color: 'inherit',
    display: 'inline-block',
    fontFamily: 'var(--font-sans)',
    // Inherits the size, so it scales with whatever text it sits in.
    fontSize: '1em',
    fontWeight: 500,
    letterSpacing: '-0.02em',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
  withIcon: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: '0.4em',
  },
});

export type WordmarkProps = Omit<ComponentProps<'span'>, 'children' | 'style'> & {
  /** The app icon's URL: each app passes its own asset. Without it, the word alone. */
  icon?: string | undefined;
  style?: StyleXStyles | undefined;
};

/**
 * `Angaria` in Suisse Intl Medium, after the app icon when `icon` is given
 * (centered on the caps). Size it with `style` (fontSize); the icon follows.
 */
const Wordmark = ({ className, icon, style, ...props }: WordmarkProps) => (
  <span
    data-slot="wordmark"
    {...stylexProps(
      styles.root,
      icon !== undefined && styles.withIcon,
      customClassName(className),
      style,
    )}
    {...props}
  >
    {icon === undefined ? (
      WORDMARK
    ) : (
      <>
        <img alt={''} src={icon} {...stylexProps(styles.icon)} />
        <span {...stylexProps(capStyles.text)}>{WORDMARK}</span>
      </>
    )}
  </span>
);

export { Wordmark };
