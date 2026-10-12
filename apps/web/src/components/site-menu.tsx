import { Popover, PopoverContent, PopoverTrigger } from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, defaultMarker, keyframes, props } from '@stylexjs/stylex';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { SOURCE_URL } from '../lib/config.ts';
import { m } from '../paraglide/messages.js';
import { GitHubMark } from './cta.tsx';

/** One of the header's links, as the menu lists it. */
export interface MenuLink {
  /** The section in view, which the header marks. */
  current: boolean;
  href: string;
  label: string;
}

/** Where the header has room for its links, and the menu goes. */
export const WIDE_QUERY = '(min-width: 768px)';
/** How far the page may run under an open menu before the menu closes, in pixels. */
const SCROLL_CLOSE = 24;
/** Each item of the menu after the one before it, as they come in, in milliseconds. */
const STAGGER = 40;
/** How far each line of the button stands from the middle, in pixels. */
const LINE_OFFSET = 3.5;
const LESS_MOTION = '@media (prefers-reduced-motion: reduce)';

/** An item of the menu coming in: a short rise out of a blur. */
const itemIn = keyframes({
  from: { filter: 'blur(2px)', opacity: 0, transform: 'translateY(8px)' },
});

const styles = create({
  after: (ms: number) => ({
    animationDelay: `${ms}ms`,
  }),
  // The two lines, and the cross they turn into. Only a narrow window has
  // it; the pseudo-element takes the touch a finger's width around it.
  button: {
    '::before': {
      content: '',
      inset: '-8px',
      position: 'absolute',
    },
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 999,
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': {
        '@media (hover: hover)': colors.fg,
        default: null,
      },
      default: colors.muted,
    },
    cursor: 'pointer',
    display: {
      '@media (min-width: 768px)': 'none',
      default: 'flex',
    },
    flexShrink: 0,
    height: 28,
    justifyContent: 'center',
    justifySelf: 'end',
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    padding: 0,
    position: 'relative',
    width: 28,
  },
  buttonOpen: {
    color: colors.fg,
  },
  // One row of the menu, tall enough for a thumb.
  item: {
    alignItems: 'center',
    animationDuration: '250ms',
    animationFillMode: 'backwards',
    animationName: {
      default: itemIn,
      [LESS_MOTION]: 'none',
    },
    animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
    color: colors.fg,
    display: 'flex',
    fontSize: font.sizeMd,
    gap: spacing.s2,
    minHeight: 44,
    outlineColor: colors.muted,
    outlineOffset: -2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    textDecorationLine: 'none',
  },
  line: {
    backgroundColor: 'currentColor',
    borderRadius: 1,
    height: 1.5,
    position: 'absolute',
    // Back to two lines quicker than they crossed.
    transitionDuration: {
      default: '150ms',
      [LESS_MOTION]: '0ms',
    },
    transitionProperty: 'transform',
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
    width: 16,
  },
  lineLower: {
    transform: `translateY(${LINE_OFFSET}px)`,
  },
  lineLowerOpen: {
    transform: 'rotate(-45deg)',
  },
  lineOpen: {
    transitionDuration: {
      default: '250ms',
      [LESS_MOTION]: '0ms',
    },
  },
  lineUpper: {
    transform: `translateY(-${LINE_OFFSET}px)`,
  },
  lineUpperOpen: {
    transform: 'rotate(45deg)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
  },
  morph: (name: string) => ({
    viewTransitionName: name,
  }),
  // The panel under the header, the window's width less the gutter at each side.
  panel: {
    borderRadius: 16,
    gap: 0,
    maxHeight: 'var(--available-height)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    paddingBlockEnd: spacing.s2,
    paddingBlockStart: spacing.s2,
    paddingInline: spacing.s4,
    width: `calc(100vw - 2 * ${spacing.s4})`,
  },
  // A line between the places on the page and the source code.
  rule: {
    backgroundColor: colors.border,
    height: 1,
    marginBlock: spacing.s2,
  },
});

/** One row of the menu, in its place in the order they come in by. */
function Item({
  children,
  current = false,
  href,
  onPick,
  place,
}: {
  children: ReactNode;
  current?: boolean;
  href: string;
  onPick: () => void;
  place: number;
}) {
  return (
    <a
      aria-current={current ? 'location' : undefined}
      href={href}
      onClick={onPick}
      {...props(styles.item, styles.after(place * STAGGER), defaultMarker())}
    >
      {children}
    </a>
  );
}

/**
 * The header's menu on a narrow window, as on attentionawareness: the button
 * of two lines at the header's far edge, and the panel it opens under the
 * header, in the open strip and in the pill alike. The lines cross as it
 * opens and the items follow a step apart. A link, Escape, a press outside
 * it, the page running on under it or a wider window all close it. The page
 * behind stays free to scroll: this is a panel, not a sheet.
 */
export function SiteMenu({
  anchor,
  links,
  morph,
}: {
  /** The header's row, which the panel hangs under. */
  anchor: RefObject<HTMLElement | null>;
  links: ReadonlyArray<MenuLink>;
  /** The name the header's morph carries the button by. */
  morph: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = () => setOpen(false);
    const from = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - from) > SCROLL_CLOSE) {
        close();
      }
    };
    const wide = window.matchMedia(WIDE_QUERY);
    window.addEventListener('scroll', onScroll, { passive: true });
    wide.addEventListener('change', close);
    return () => {
      window.removeEventListener('scroll', onScroll);
      wide.removeEventListener('change', close);
    };
  }, [open]);

  const pick = () => setOpen(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label={open ? m.header_menu_close() : m.header_menu_open()}
        data-morph={morph}
        {...props(styles.button, open && styles.buttonOpen, styles.morph(morph))}
      >
        <span
          aria-hidden="true"
          {...props(
            styles.line,
            styles.lineUpper,
            open && styles.lineOpen,
            open && styles.lineUpperOpen,
          )}
        />
        <span
          aria-hidden="true"
          {...props(
            styles.line,
            styles.lineLower,
            open && styles.lineOpen,
            open && styles.lineLowerOpen,
          )}
        />
      </PopoverTrigger>
      <PopoverContent
        anchor={anchor}
        aria-label={m.header_menu()}
        sideOffset={8}
        style={styles.panel}
      >
        <nav aria-label={m.header_menu()} {...props(styles.list)}>
          {links.map((link, place) => (
            <Item
              current={link.current}
              href={link.href}
              key={link.href}
              onPick={pick}
              place={place}
            >
              {link.label}
            </Item>
          ))}
        </nav>
        <div aria-hidden="true" {...props(styles.rule)} />
        <Item href={SOURCE_URL} onPick={pick} place={links.length}>
          <GitHubMark />
          {m.cta_source()}
        </Item>
      </PopoverContent>
    </Popover>
  );
}
