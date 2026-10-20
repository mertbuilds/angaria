import { Button, Wordmark } from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, defaultMarker, props } from '@stylexjs/stylex';
import { useLocation } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { track } from '../lib/analytics.ts';
import { SOURCE_URL } from '../lib/config.ts';
import { morph } from '../lib/morph.ts';
import { m } from '../paraglide/messages.js';
import { AppIcon } from './app-icon.tsx';
import { DownloadButton, GitHubMark } from './cta.tsx';
import { SiteMenu, type MenuLink } from './site-menu.tsx';

/** Where the header has room for its links; under it they are in the menu (WIDE_QUERY). */
const WIDE = '@media (min-width: 768px)';

const MARK_SIZE = 24;
/**
 * The pill holds the download, 28px tall, with this much room around it, so
 * the pill is as round as the button plus the room.
 */
const PILL_INSET = 6;
const PILL_HEIGHT = 28 + 2 * PILL_INSET;
/** In the pill the mark is as far from the pill's end as the download is from the other. */
const PILL_MARK = PILL_HEIGHT - 2 * PILL_INSET;
/**
 * How far down the page the pill takes over, and how far back up the open
 * header returns. The gap between them keeps a page resting near one line
 * from flipping between the two.
 */
const PILL_FROM = 48;
const OPEN_FROM = 16;
/** The line across the window that a section must lie on to be the one in view: 30% of the way down. */
const VIEW_LINE = '-30% 0px -70% 0px';

/** The landing's sections, by the ids it gives them, in the order they stand. */
const SECTIONS = [
  { id: 'mcp', label: m.header_nav_mcp, name: 'header-mcp' },
  { id: 'nasil', label: m.header_nav_how, name: 'header-how' },
  { id: 'ozellikler', label: m.header_nav_features, name: 'header-features' },
  { id: 'gizlilik', label: m.header_nav_privacy, name: 'header-privacy' },
  { id: 'sss', label: m.header_nav_faq, name: 'header-faq' },
] as const;

const styles = create({
  // The download and GitHub at the far edge.
  actions: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: spacing.s2,
    justifySelf: 'end',
  },
  // The row of items, laid out as the open strip or as the pill. Every item
  // stands above the ground drawn behind them.
  bar: {
    alignItems: 'center',
    boxSizing: 'border-box',
    pointerEvents: 'auto',
    position: 'relative',
  },
  // Open: the name at one edge, the download at the other, and the links in
  // the middle between two equal sides. A window too narrow for the links
  // keeps the name and, at the other edge, the menu's button.
  barOpen: {
    columnGap: spacing.s4,
    display: 'grid',
    gridAutoColumns: 'auto',
    gridAutoFlow: 'column',
    gridTemplateColumns: {
      default: 'minmax(0, 1fr) auto',
      [WIDE]: 'minmax(0, 1fr) auto minmax(0, 1fr)',
    },
  },
  // The pill: the mark, the links and the download, in the middle and only
  // as wide as they are. On a narrow window: the mark, the download and the
  // menu's button.
  barPill: {
    alignSelf: 'center',
    display: 'flex',
    gap: {
      default: spacing.s3,
      [WIDE]: spacing.s6,
    },
    height: PILL_HEIGHT,
    justifySelf: 'center',
    paddingBlock: PILL_INSET,
    paddingInline: PILL_INSET,
  },
  brand: {
    alignItems: 'center',
    color: colors.fg,
    display: 'inline-flex',
    gap: spacing.s2,
    justifySelf: 'start',
    maxWidth: '100%',
    minWidth: 0,
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    position: 'relative',
    textDecorationLine: 'none',
  },
  brandPill: {
    borderRadius: '50%',
  },
  // A round icon button as tall as the download. A narrow window has no room
  // for it; the menu has GitHub there.
  github: {
    display: {
      default: 'none',
      [WIDE]: 'inline-flex',
    },
    paddingInline: 0,
    width: 28,
  },
  // The strip at the top of the window, wider than the text column like the
  // hero's screenshot. Only the row takes the pointer, so the page beside
  // the pill stays in reach.
  header: {
    display: 'grid',
    height: 64,
    insetBlockStart: 0,
    marginInline: 'calc(50% - min(50vw - 16px, 540px))',
    pointerEvents: 'none',
    position: 'sticky',
    zIndex: 30,
  },
  hidden: {
    display: 'none',
  },
  link: {
    color: {
      ':hover': {
        '@media (hover: hover)': colors.fg,
        default: null,
      },
      default: colors.muted,
    },
    fontSize: font.sizeSm,
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    textDecorationLine: 'none',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    transitionProperty: 'color',
    transitionTimingFunction: 'ease-out',
    whiteSpace: 'nowrap',
  },
  // The link of the section in view takes the text's own color.
  linkCurrent: {
    color: colors.fg,
  },
  // The mark as an item of its own, so it can move without the name: the
  // tile's own corner in the open strip, a circle in the pill.
  mark: {
    borderRadius: '22%',
    display: 'flex',
    flexShrink: 0,
    overflow: 'hidden',
  },
  markRound: {
    borderRadius: '50%',
  },
  morph: (name: string) => ({
    viewTransitionName: name,
  }),
  name: {
    fontSize: 17,
  },
  nav: {
    alignItems: 'center',
    display: {
      default: 'none',
      [WIDE]: 'flex',
    },
    gap: spacing.s6,
    position: 'relative',
  },
  // The ground behind the row: nothing while the header is open, and the
  // pill once it gathers, the page blurred through a tint of it, a hairline
  // at its edge and a soft shadow under it. Solid where the reader asked for
  // less transparency.
  surface: {
    backdropFilter: {
      '@media (prefers-reduced-transparency: reduce)': 'none',
      default: 'blur(16px) saturate(1.4)',
    },
    backgroundColor: {
      '@media (prefers-reduced-transparency: reduce)': colors.bg,
      default: `color-mix(in srgb, ${colors.bg} 65%, transparent)`,
    },
    borderColor: `color-mix(in srgb, ${colors.fg} 10%, transparent)`,
    borderRadius: 0,
    borderStyle: 'solid',
    borderWidth: 1,
    boxShadow: '0 8px 32px rgb(0 0 0 / 0.08)',
    boxSizing: 'border-box',
    inset: 0,
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    WebkitBackdropFilter: {
      '@media (prefers-reduced-transparency: reduce)': 'none',
      default: 'blur(16px) saturate(1.4)',
    },
  },
  surfacePill: {
    borderRadius: PILL_HEIGHT / 2,
    opacity: 1,
  },
});

/** The id of the landing's section that lies on the view line, while on the landing. */
function useSectionInView(home: boolean) {
  const [inView, setInView] = useState<string | null>(null);

  useEffect(() => {
    if (!home || typeof IntersectionObserver === 'undefined') {
      return;
    }
    // Each id is a section's heading; the section around it is what lies on the line.
    const ids = new Map<Element, string>();
    for (const { id } of SECTIONS) {
      const heading = document.getElementById(id);
      if (heading !== null) {
        ids.set(heading.closest('section') ?? heading, id);
      }
    }
    const [first] = ids.keys();
    const on = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        let above = false;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            on.add(entry.target);
          } else {
            on.delete(entry.target);
          }
          if (entry.target === first) {
            above =
              !entry.isIntersecting && entry.boundingClientRect.top > (entry.rootBounds?.top ?? 0);
          }
        }
        // Between two sections the last one stays in view; above the first there is none.
        const [element] = on;
        if (element !== undefined) {
          setInView(ids.get(element) ?? null);
        } else if (above) {
          setInView(null);
        }
      },
      { rootMargin: VIEW_LINE },
    );
    for (const section of ids.keys()) {
      observer.observe(section);
    }
    return () => observer.disconnect();
  }, [home]);

  return home ? inView : null;
}

/**
 * The app's icon and name at the left and the way home, the landing's
 * sections in the middle, and GitHub and the download at the right, as on
 * attentionawareness and Agent Caffeine. The link of the section in view
 * takes the text's own color. Once the page has run a little way under it,
 * the items gather into a pill in the middle, the icon alone for the name, and
 * open back out near the top. A window too narrow for the links keeps the
 * name and the download, and has the menu's button at the far edge with the
 * links in the menu it opens.
 */
export function SiteHeader() {
  const [pill, setPill] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLSpanElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const home = useLocation({ select: (location) => location.pathname === '/' });
  const inView = useSectionInView(home);
  // On the landing a bare hash scrolls in place.
  const page = home ? '' : '/';
  const links: Array<MenuLink & { name: string }> = SECTIONS.map((section) => ({
    current: section.id === inView,
    href: `${page}#${section.id}`,
    label: section.label(),
    name: section.name,
  }));

  // The pill takes over past one line and gives way above another. Only a
  // change between the two moves anything; the page as it first loads is
  // drawn as it is.
  useEffect(() => {
    let current = false;
    function update(first: boolean) {
      const next = window.scrollY > (current ? OPEN_FROM : PILL_FROM);
      if (next === current) {
        return;
      }
      current = next;
      const root = bar.current;
      const ground = surface.current;
      if (first || root === null || ground === null) {
        setPill(next);
        return;
      }
      morph({
        gather: next,
        live: mark.current === null ? [] : [mark.current],
        root,
        surface: ground,
        update: () => flushSync(() => setPill(next)),
      });
    }
    update(true);
    const onScroll = () => update(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header {...props(styles.header)}>
      <div ref={bar} {...props(styles.bar, pill ? styles.barPill : styles.barOpen)}>
        <span
          aria-hidden="true"
          ref={surface}
          {...props(styles.surface, pill && styles.surfacePill)}
        />
        <a aria-label={m.header_home()} href="/" {...props(styles.brand, pill && styles.brandPill)}>
          <span ref={mark} {...props(styles.mark, pill && styles.markRound)}>
            <AppIcon size={pill ? PILL_MARK : MARK_SIZE} />
          </span>
          <Wordmark
            data-morph="header-name"
            style={[styles.name, styles.morph('header-name'), pill && styles.hidden]}
          />
        </a>
        <nav aria-label={m.header_nav()} {...props(styles.nav)}>
          {links.map((link) => (
            <a
              aria-current={link.current ? 'location' : undefined}
              data-morph={link.name}
              href={link.href}
              key={link.name}
              {...props(
                styles.link,
                link.current && styles.linkCurrent,
                styles.morph(link.name),
                defaultMarker(),
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <span {...props(styles.actions)}>
          <Button
            aria-label={m.header_source()}
            data-morph="header-github"
            onClick={() => track('source_click', { location: 'header' })}
            render={<a href={SOURCE_URL} rel="noreferrer" target="_blank" />}
            style={[styles.github, styles.morph('header-github')]}
            variant="outline"
          >
            <GitHubMark />
          </Button>
          <DownloadButton label={m.header_download()} location="header" morph="header-download" />
        </span>
        <SiteMenu anchor={bar} links={links} morph="header-menu" />
      </div>
    </header>
  );
}
