import { m } from '../paraglide/messages.js';

/** The widths every screenshot is exported at, in pixels (public/screens/README.md). */
const WIDTHS = [1440, 2880] as const;

export type Theme = 'dark' | 'light';

/**
 * One app screenshot in public/screens, exported at every width in WIDTHS as
 * `<name>-<theme>[-framed]-<width>.webp`, or `<name>-<width>.webp` when it
 * has one version for both themes (the PDF is paper).
 */
export interface Screen {
  alt: () => string;
  /** Drawn as a macOS window: 12px corners on a transparent background. */
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

/** Every screenshot the landing page shows, by where it shows. */
export const SCREENS = {
  compare: screen('yeni-fatura', m.screen_compare_alt),
  customers: screen('musteriler', m.screen_customers_alt),
  hero: screen('faturalar-detail', m.screen_hero_alt, { framed: true }),
  invoices: screen('faturalar-detail', m.screen_invoices_alt),
  license: screen('license', m.screen_license_alt),
  palette: screen('palette', m.screen_palette_alt),
  pdf: screen('pdf', m.screen_pdf_alt, { height: 2037, themed: false }),
  rates: screen('yeni-fatura', m.screen_rates_alt),
  sign: screen('sms', m.screen_sign_alt),
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
