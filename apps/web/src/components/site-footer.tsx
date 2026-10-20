import { Wordmark } from '@angaria/ui';
import { colors, font, motion, spacing } from '@angaria/ui/tokens.stylex';
import { create, defaultMarker, props, when } from '@stylexjs/stylex';
import { Star } from 'lucide-react';
import { useId, type MouseEvent } from 'react';
import { track } from '../lib/analytics.ts';
import { config, LICENSE_URL, SOURCE_URL } from '../lib/config.ts';
import { onDownloadClick } from '../lib/send-to-mac.ts';
import { Sentence } from '../lib/slot.tsx';
import { m } from '../paraglide/messages.js';
import { AppIcon } from './app-icon.tsx';
import { GitHubMark } from './cta.tsx';
import { ThemeSwitch } from './theme-switch.tsx';

export const CONTACT_EMAIL = 'destek@angaria.app';
/** Every link to one of our own sites carries utm tags, so the visit is traced to this one. */
const AUTHOR_URL =
  'https://mertbuilds.com/?utm_source=angaria.app&utm_medium=referral&utm_campaign=footer';
/** The mark on the brand's line, as large as the header draws it. */
const MARK_SIZE = 24;
/** The star, as large as GitHub's mark above it. */
const STAR_SIZE = 14;

const styles = create({
  // The mark, the name and what this is.
  brand: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  brandLink: {
    alignItems: 'center',
    color: colors.fg,
    display: 'inline-flex',
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    gap: spacing.s2,
    textDecorationLine: 'none',
  },
  // Four columns at full width, two on a tablet and one on a phone.
  columns: {
    columnGap: spacing.s6,
    display: 'grid',
    gridTemplateColumns: {
      '@media (min-width: 640px) and (max-width: 899px)': 'repeat(2, minmax(0, 1fr))',
      '@media (min-width: 900px)': 'minmax(0, 1.5fr) repeat(3, minmax(0, 1fr))',
      default: 'minmax(0, 1fr)',
    },
    rowGap: spacing.s8,
  },
  // Who made it and the GİB note. They give way to the theme control and wrap.
  credit: {
    display: 'flex',
    flexBasis: 280,
    flexDirection: 'column',
    flexGrow: 1,
    gap: spacing.s1,
    lineHeight: 1.5,
  },
  footer: {
    color: colors.muted,
    display: 'flex',
    flexDirection: 'column',
    fontSize: font.sizeSm,
    gap: spacing.s8,
    marginBlockStart: spacing.s16,
    paddingBlock: spacing.s8,
  },
  // A column's name, in the ink, as tall as the mark beside it so the four
  // columns start on one line.
  heading: {
    color: colors.fg,
    fontSize: font.sizeSm,
    fontWeight: font.weightRegular,
    lineHeight: `${MARK_SIZE}px`,
    margin: 0,
  },
  // Who made it, the GİB note and the theme control share a row under a
  // hairline. A phone wraps the control under the words.
  last: {
    alignItems: 'center',
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s4,
    justifyContent: 'space-between',
    paddingBlockStart: spacing.s6,
  },
  // The star before its link, and the box its filled twin is laid over.
  icon: {
    display: 'flex',
    flexShrink: 0,
    position: 'relative',
  },
  line: {
    margin: 0,
  },
  // Quiet until pointed at, as the header's links are. Tall enough for a
  // thumb on a phone.
  link: {
    alignItems: 'center',
    color: {
      ':hover': {
        '@media (hover: hover)': colors.fg,
        default: null,
      },
      default: colors.muted,
    },
    display: 'inline-flex',
    fontSize: font.sizeSm,
    lineHeight: '20px',
    minHeight: {
      '@media (max-width: 639px)': 44,
      default: 32,
    },
    textDecorationLine: 'none',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  // The way to the code and the ask for a star: an icon before the words, and
  // a ring when a key reaches them.
  source: {
    gap: spacing.s2,
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    transitionProperty: 'color',
    transitionTimingFunction: 'ease-out',
  },
  // The star filled in, over its outline, while the link is pointed at.
  starFilled: {
    fill: 'currentColor',
    inset: 0,
    opacity: {
      default: 0,
      [when.ancestor(':hover')]: {
        '@media (hover: hover)': 1,
        default: null,
      },
    },
    position: 'absolute',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: motion.fade,
    },
    transitionProperty: 'opacity',
    transitionTimingFunction: 'ease-out',
  },
  tagline: {
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '32ch',
  },
});

interface FooterLink {
  /** Leaves the site, in a tab of its own. */
  external?: boolean;
  href: string;
  label: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

/** A column of links under its name. */
function Column({ links, title }: { links: ReadonlyArray<FooterLink>; title: string }) {
  const heading = useId();
  return (
    <nav aria-labelledby={heading}>
      <h2 id={heading} {...props(styles.heading)}>
        {title}
      </h2>
      <ul {...props(styles.list)}>
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              onClick={link.onClick}
              rel={link.external ? 'noreferrer' : undefined}
              target={link.external ? '_blank' : undefined}
              {...props(styles.link)}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const onSource = () => track('source_click', { location: 'footer' });

/**
 * The same footer on every page: the name and what Angaria is with the way to
 * the code and the ask for a star, then the product, the project and the legal pages in three columns of links, then
 * who made it, the GİB note and the theme control in a last row.
 */
export function SiteFooter() {
  const product: ReadonlyArray<FooterLink> = [
    {
      href: config.downloadUrl,
      label: m.footer_download(),
      onClick: (event) => onDownloadClick(event, 'footer'),
    },
    { href: '/#mcp', label: m.header_nav_mcp() },
    { href: '/#nasil', label: m.header_nav_how() },
    { href: '/#ozellikler', label: m.header_nav_features() },
    { href: '/#sss', label: m.header_nav_faq() },
  ];
  const project: ReadonlyArray<FooterLink> = [
    { external: true, href: LICENSE_URL, label: m.footer_license_link() },
    { href: `mailto:${CONTACT_EMAIL}`, label: CONTACT_EMAIL },
  ];
  const legal: ReadonlyArray<FooterLink> = [
    { href: '/gizlilik', label: m.footer_privacy() },
    { href: '/kosullar', label: m.footer_terms() },
  ];

  return (
    <footer {...props(styles.footer)}>
      <div {...props(styles.columns)}>
        <div {...props(styles.brand)}>
          <a aria-label={m.header_home()} href="/" {...props(styles.brandLink)}>
            <AppIcon size={MARK_SIZE} />
            <Wordmark />
          </a>
          <p {...props(styles.tagline)}>{m.footer_tagline()}</p>
          <ul {...props(styles.list)}>
            <li>
              <a
                href={SOURCE_URL}
                onClick={onSource}
                rel="noreferrer"
                target="_blank"
                {...props(styles.link, styles.source)}
              >
                <GitHubMark />
                {m.footer_source()}
              </a>
            </li>
            <li>
              <a
                href={SOURCE_URL}
                onClick={onSource}
                rel="noreferrer"
                target="_blank"
                {...props(styles.link, styles.source, defaultMarker())}
              >
                <span {...props(styles.icon)}>
                  <Star aria-hidden="true" size={STAR_SIZE} />
                  <Star aria-hidden="true" size={STAR_SIZE} {...props(styles.starFilled)} />
                </span>
                {m.footer_star()}
              </a>
            </li>
          </ul>
        </div>
        <Column links={product} title={m.footer_product()} />
        <Column links={project} title={m.footer_project()} />
        <Column links={legal} title={m.footer_legal()} />
      </div>
      <div {...props(styles.last)}>
        <div {...props(styles.credit)}>
          <p {...props(styles.line)}>
            <Sentence
              message={(author) => m.footer_made_by({ author })}
              slots={[
                <a href={AUTHOR_URL} key="author" rel="noreferrer" target="_blank">
                  {m.footer_author()}
                </a>,
              ]}
            />
          </p>
          <p {...props(styles.line)}>{m.footer_disclaimer()}</p>
        </div>
        <ThemeSwitch />
      </div>
    </footer>
  );
}
