import { Button } from '@angaria/ui';
import { font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';
import { SiteFooter } from '../components/site-footer.tsx';
import { SiteHeader } from '../components/site-header.tsx';
import { startAnalytics } from '../lib/analytics.ts';
import { SITE_URL } from '../lib/canonical.ts';
import { layout } from '../lib/layout.ts';
import { THEME_GROUND, THEME_SCRIPT } from '../lib/theme.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';
import '@angaria/ui/fonts.css';
import '@angaria/ui/theme.css';
import '@angaria/ui/base.css';
import '../brand.css';
import '../app.css';

if (import.meta.env.DEV && typeof window !== 'undefined') {
  // Dev-only: StyleX HMR runtime injects styles; production CSS is emitted into app.css at build.
  void import('virtual:stylex:runtime');
  // Dev-only: devknobs emulates color scheme, motion, contrast, locale, geo and
  // layout from inside the page (⇧K toggles it), and grabs an element's context
  // for an agent (⇧G).
  // oxlint-disable-next-line unicorn/prefer-top-level-await -- awaiting here would stop the route module from evaluating if the chunk fails
  void import('devknobs')
    .then(({ mount }) => mount())
    // oxlint-disable-next-line no-console -- the browser console is the only channel this dev-only failure has
    .catch((error: unknown) => console.warn('devknobs failed to load', error));
}

const OG_IMAGE = `${SITE_URL}/og.png`;

const styles = create({
  main: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: {
      '@media (min-width: 640px)': spacing.s16,
      default: spacing.s12,
    },
    paddingBlockStart: {
      '@media (min-width: 640px)': spacing.s8,
      default: spacing.s4,
    },
  },
  notFound: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  // One 720px column with a 16px gutter on every page.
  shell: {
    boxSizing: 'content-box',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    fontSize: 15,
    lineHeight: 1.6,
    marginInline: 'auto',
    maxWidth: 720,
    minHeight: '100dvh',
    paddingInline: spacing.s4,
  },
});

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    links: [
      // The app icon, from `pnpm icons`.
      { href: '/favicon.png', rel: 'icon', sizes: '32x32', type: 'image/png' },
      { href: '/icon-192.png', rel: 'icon', sizes: '192x192', type: 'image/png' },
      { href: '/apple-touch-icon.png', rel: 'apple-touch-icon' },
      { href: '/site.webmanifest', rel: 'manifest' },
      // Dev-only: link the unplugin's compiled CSS so SSR HTML is styled on first
      // paint (the virtual:stylex:runtime import only injects after hydration).
      // Production CSS is emitted into app.css at build, so the link is dev-only.
      // `precedence` is required: React 19 hoists SSR stylesheets with
      // data-precedence, and a client link without the prop hydration-mismatches.
      ...(import.meta.env.DEV
        ? [{ href: '/virtual:stylex.css', precedence: 'default', rel: 'stylesheet' }]
        : []),
    ],
    meta: [
      // oxlint-disable-next-line text-encoding-identifier-case -- HTML meta charset must be "utf-8"
      { charSet: 'utf-8' },
      { content: 'width=device-width, initial-scale=1', name: 'viewport' },
      { title: m.meta_title() },
      { content: m.meta_description(), name: 'description' },
      { content: 'Angaria', property: 'og:site_name' },
      { content: 'tr_TR', property: 'og:locale' },
      { content: 'website', property: 'og:type' },
      { content: m.meta_og_title(), property: 'og:title' },
      { content: m.meta_description(), property: 'og:description' },
      { content: OG_IMAGE, property: 'og:image' },
      { content: '1200', property: 'og:image:width' },
      { content: '630', property: 'og:image:height' },
      { content: 'summary_large_image', name: 'twitter:card' },
      { content: OG_IMAGE, name: 'twitter:image' },
    ],
  }),
  notFoundComponent: NotFound,
});

function RootComponent() {
  useEffect(() => {
    // Marks hydration completion; browser checks wait for html[data-hydrated].
    document.documentElement.dataset['hydrated'] = 'true';
    void startAnalytics();
  }, []);
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function NotFound() {
  return (
    <section {...props(styles.notFound)}>
      <h1 {...props(layout.title)}>{m.not_found_title()}</h1>
      <p {...props(layout.text, layout.muted)}>{m.not_found_body()}</p>
      <Button render={<Link to="/" />} variant="outline">
        {m.not_found_home()}
      </Button>
    </section>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // The theme's script marks the element before the page comes alive.
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* The page's ground, for the browser's own chrome and what it shows
        behind the page: one per system theme, written here because the head's
        list keeps one meta per name. A theme chosen in the footer adds its own
        (`lib/theme.ts`), and the script under them does it for a kept choice. */}
        <meta
          content={THEME_GROUND.light}
          media="(prefers-color-scheme: light)"
          name="theme-color"
        />
        <meta content={THEME_GROUND.dark} media="(prefers-color-scheme: dark)" name="theme-color" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <div {...props(styles.shell)}>
          <SiteHeader />
          <main {...props(styles.main)}>{children}</main>
          <SiteFooter />
        </div>
        <Scripts />
      </body>
    </html>
  );
}
