import { m } from '../paraglide/messages.js';

/** The widths every screenshot is exported at, in pixels (docs/screenshots.md). */
const WIDTHS = [1440, 2880] as const;

export type Theme = 'dark' | 'light';

/**
 * One screenshot in public/screens, exported at every width in WIDTHS as
 * `<name>-<theme>[-framed]-<width>.webp`, or `<name>-<width>.webp` when it
 * has one version for both themes (the PDF is paper, the GİB portal has no
 * dark theme).
 */
export interface Screen {
  alt: () => string;
  /** Drawn as a macOS window: 20px corners on a transparent background. */
  framed: boolean;
  /** Pixel size of the 1440 export; the 2880 one is twice that. */
  height: number;
  name: string;
  themed: boolean;
  width: number;
}

const screen = (
  name: string,
  alt: () => string,
  { framed = false, height = 900, themed = true } = {},
): Screen => ({ alt, framed, height, name, themed, width: 1440 });

/** Every screenshot the site shows, by where it shows. */
export const SCREENS = {
  compare: screen('yeni-fatura', m.screen_compare_alt),
  customers: screen('musteriler', m.screen_customers_alt),
  gib: screen('gib-portal', m.screen_gib_alt, { themed: false }),
  hero: screen('faturalar-detail', m.screen_hero_alt, { framed: true }),
  mcp: screen('mcp', m.screen_mcp_alt, { framed: true }),
  palette: screen('palette', m.screen_palette_alt),
  pdf: screen('pdf', m.screen_pdf_alt, { height: 2037, themed: false }),
  rates: screen('yeni-fatura', m.screen_rates_alt),
  start: screen('yeni-start', m.screen_start_alt),
} satisfies Record<string, Screen>;

const file = ({ framed, name, themed }: Screen, theme: Theme, width: number) =>
  themed
    ? `/screens/${name}-${theme}${framed ? '-framed' : ''}-${width}.webp`
    : `/screens/${name}-${width}.webp`;

/** The `src` and `srcset` of one theme's export. */
export function screenSources(screen: Screen, theme: Theme) {
  return {
    src: file(screen, theme, WIDTHS[0]),
    srcSet: WIDTHS.map((width) => `${file(screen, theme, width)} ${width}w`).join(', '),
  };
}
