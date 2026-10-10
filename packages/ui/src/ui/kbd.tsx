'use client';

import { create, props as stylexProps } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import {
  ArrowBigUpIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ChevronUpIcon,
  CommandIcon,
  CornerDownLeftIcon,
  DeleteIcon,
  type LucideIcon,
  OptionIcon,
} from 'lucide-react';
import { Children, type ComponentProps, Fragment, type ReactNode } from 'react';
import { capText } from '../lib/cap-text.tsx';
import { colors } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';

const styles = create({
  group: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: '0.25rem',
  },
  iconLead: {
    marginInlineStart: '-1px',
  },
  iconTrail: {
    marginInlineEnd: '-1px',
  },
  // The key's name for screen readers and copy, where the icon shows it.
  keyName: {
    clipPath: 'inset(50%)',
    height: '1px',
    overflow: 'hidden',
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: '1px',
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
    flexShrink: 0,
    fontFamily: 'inherit',
    fontSize: '0.75rem',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 500,
    gap: '0.125rem',
    // A square for one key; wider keys grow from it.
    height: '1.25rem',
    justifyContent: 'center',
    lineHeight: 1,
    minWidth: '1.25rem',
    // Room for a 0.6875rem key icon (theme.css) inside the square.
    paddingInline: '0.1875rem',
    pointerEvents: 'none',
    // Holds the hidden key names: without a positioned ancestor they lay out
    // against the page and stretch it past any scroll region they sit in.
    position: 'relative',
    userSelect: 'none',
    // Centered on the text around it, whatever the key shows: an icon has no
    // baseline to line up.
    verticalAlign: 'middle',
    width: 'fit-content',
  },
});

// Symbol keys draw as icons, which center exactly. Suisse Intl has no ↵, ⌘, ⇧
// or ⌫, and a fallback font's glyph sits on its own metrics, up to 2px off the
// middle of the key; the arrows follow, so a row of keys draws alike.
const keyIcons: Record<string, LucideIcon> = {
  '←': ArrowLeftIcon,
  '→': ArrowRightIcon,
  '↑': ArrowUpIcon,
  '↓': ArrowDownIcon,
  '↵': CornerDownLeftIcon,
  '⇧': ArrowBigUpIcon,
  '⌃': ChevronUpIcon,
  '⌘': CommandIcon,
  '⌥': OptionIcon,
  '⌫': DeleteIcon,
};
const keySymbols = /([←↑→↓↵⇧⌃⌘⌥⌫])/u;
const isText = (part: string | undefined) => part !== undefined && !keyIcons[part];

// Adjacent strings as one, so `{mod}D` reads like `⌘D`.
const joinText = (children: ReactNode) =>
  Children.toArray(children).reduce<Array<ReactNode>>((out, child) => {
    const last = out.at(-1);
    if ((typeof child === 'string' || typeof child === 'number') && typeof last === 'string') {
      out[out.length - 1] = last + String(child);
    } else {
      out.push(typeof child === 'number' ? String(child) : child);
    }
    return out;
  }, []);

const keyParts = (children: ReactNode) =>
  joinText(children).map((child) => {
    if (typeof child !== 'string') {
      return child;
    }
    const parts = child.split(keySymbols).filter((part) => part.trim());
    return parts.map((part, index) => {
      const Icon = keyIcons[part];
      if (!Icon) {
        return part;
      }
      // An icon's box is wider than its ink; at the key's edge, beside a
      // letter's tight side, it would push the pair off center (⌘K, Ctrl ⇧).
      const leads = index === 0 && isText(parts.at(-1));
      const trails = index === parts.length - 1 && isText(parts[0]);
      return (
        <Fragment key={index}>
          <Icon
            aria-hidden
            // The weight of the key's 500 text.
            strokeWidth={2.25}
            {...stylexProps(leads && styles.iconLead, trails && styles.iconTrail)}
          />
          <span {...stylexProps(styles.keyName)}>{part}</span>
        </Fragment>
      );
    });
  });

export type KbdProps = Omit<ComponentProps<'kbd'>, 'style'> & {
  style?: StyleXStyles | undefined;
};

const Kbd = ({ children, className, style, ...props }: KbdProps) => (
  <kbd data-slot="kbd" {...stylexProps(styles.root, customClassName(className), style)} {...props}>
    {capText(keyParts(children))}
  </kbd>
);

const KbdGroup = ({ className, style, ...props }: KbdProps) => (
  <kbd
    data-slot="kbd-group"
    {...stylexProps(styles.group, customClassName(className), style)}
    {...props}
  />
);

export { Kbd, KbdGroup };
