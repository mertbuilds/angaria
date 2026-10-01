'use client';

import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { createContext, useContext } from 'react';
import type { ComponentProps } from 'react';
import { colors, radius } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';

export type CardSize = 'default' | 'sm';

const CardContext = createContext<CardSize>('default');

const styles = create({
  action: {
    alignSelf: 'start',
    gridColumnStart: 2,
    gridRowEnd: 'span 2',
    gridRowStart: 1,
    justifySelf: 'end',
  },
  card: {
    ':has([data-slot=card-footer])': {
      paddingBottom: 0,
    },
    ':has(> img:first-child)': {
      paddingTop: 0,
    },
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.cardForeground,
    display: 'flex',
    flexDirection: 'column',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    overflow: 'hidden',
  },
  cardDefault: {
    gap: 'var(--card-spacing, 1rem)',
    paddingBottom: 'var(--card-spacing, 1rem)',
    paddingTop: 'var(--card-spacing, 1rem)',
  },
  cardSm: {
    gap: 'var(--card-spacing, 0.75rem)',
    paddingBottom: 'var(--card-spacing, 0.75rem)',
    paddingTop: 'var(--card-spacing, 0.75rem)',
  },
  contentDefault: {
    paddingInline: 'var(--card-spacing, 1rem)',
  },
  contentSm: {
    paddingInline: 'var(--card-spacing, 0.75rem)',
  },
  description: {
    color: colors.mutedForeground,
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    textWrap: 'pretty',
  },
  footer: {
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderTopColor: colors.border,
    borderTopStyle: 'solid',
    borderTopWidth: '1px',
    display: 'flex',
    gap: '0.5rem',
  },
  footerDefault: {
    padding: 'var(--card-spacing, 1rem)',
  },
  footerSm: {
    padding: 'var(--card-spacing, 0.75rem)',
  },
  header: {
    ':has([data-slot=card-action])': {
      gridTemplateColumns: '1fr auto',
    },
    ':has([data-slot=card-description])': {
      gridTemplateRows: 'auto auto',
    },
    alignItems: 'start',
    display: 'grid',
    gap: '0.25rem',
    gridAutoRows: 'min-content',
  },
  headerDefault: {
    paddingInline: 'var(--card-spacing, 1rem)',
  },
  headerSm: {
    paddingInline: 'var(--card-spacing, 0.75rem)',
  },
  title: {
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: '1.375',
    textWrap: 'balance',
  },
  titleSm: {
    fontSize: '0.875rem',
  },
});

type CardPartProps = Omit<ComponentProps<'div'>, 'style'> & {
  style?: StyleXStyles | undefined;
};

export type CardProps = CardPartProps & {
  size?: CardSize | undefined;
};

const Card = ({ className, size = 'default', style, ...props }: CardProps) => (
  <CardContext.Provider value={size}>
    <div
      data-size={size}
      data-slot="card"
      {...stylexProps(
        styles.card,
        size === 'sm' ? styles.cardSm : styles.cardDefault,
        customClassName(className),
        style,
      )}
      {...props}
    />
  </CardContext.Provider>
);

const CardHeader = ({ className, style, ...props }: CardPartProps) => {
  const size = useContext(CardContext);
  return (
    <div
      data-slot="card-header"
      {...stylexProps(
        styles.header,
        size === 'sm' ? styles.headerSm : styles.headerDefault,
        customClassName(className),
        style,
      )}
      {...props}
    />
  );
};

const CardTitle = ({ className, style, ...props }: CardPartProps) => {
  const size = useContext(CardContext);
  return (
    <div
      data-slot="card-title"
      {...stylexProps(
        styles.title,
        size === 'sm' && styles.titleSm,
        customClassName(className),
        style,
      )}
      {...props}
    />
  );
};

const CardDescription = ({ className, style, ...props }: CardPartProps) => (
  <div
    data-slot="card-description"
    {...stylexProps(styles.description, customClassName(className), style)}
    {...props}
  />
);

const CardAction = ({ className, style, ...props }: CardPartProps) => (
  <div
    data-slot="card-action"
    {...stylexProps(styles.action, customClassName(className), style)}
    {...props}
  />
);

const CardContent = ({ className, style, ...props }: CardPartProps) => {
  const size = useContext(CardContext);
  return (
    <div
      data-slot="card-content"
      {...stylexProps(
        size === 'sm' ? styles.contentSm : styles.contentDefault,
        customClassName(className),
        style,
      )}
      {...props}
    />
  );
};

const CardFooter = ({ className, style, ...props }: CardPartProps) => {
  const size = useContext(CardContext);
  return (
    <div
      data-slot="card-footer"
      {...stylexProps(
        styles.footer,
        size === 'sm' ? styles.footerSm : styles.footerDefault,
        customClassName(className),
        style,
      )}
      {...props}
    />
  );
};

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
