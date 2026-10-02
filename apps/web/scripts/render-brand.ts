import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
/**
 * Renders the site's brand assets from the real Suisse Intl Medium.
 *
 * The icon is a lowercase "a" on a black squircle. The SVG carries the letter
 * as outlines traced out of the font with fontkit, so the licensed font never
 * ships; the PNGs are screenshots of a headless Chromium page. The woff2 files
 * are gitignored (`pnpm fonts`), so run this where they have been fetched.
 *
 *   pnpm --filter web brand
 */
import { openSync as openFont } from 'fontkit';
import type { Font } from 'fontkit';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public');
const fontFile = path.resolve(root, '../../packages/ui/fonts/SuisseIntl-Medium.woff2');

const BLACK = '#000000';
const WHITE = '#ffffff';
const GRAY = '#8a8a8a';

/** The SVG icon is drawn on this square, then scaled by whatever renders it. */
const SIZE = 512;
/** How tall the letter's ink stands, as a share of the square. */
const INK_RATIO = 0.46;
/** Superellipse exponent: 2 is a circle, higher gets squarer. 5 reads as a squircle. */
const SQUIRCLE_EXPONENT = 5;
/** Points per quarter of the squircle outline. */
const SQUIRCLE_STEPS = 24;

const OG_TAGLINE = "GİB portalıyla uğraşma. Faturanı Mac'inden kes.";
const OG_DOMAIN = 'angaria.app';

const round = (value: number) => Math.round(value * 100) / 100;

/** The squircle as one closed path, centred on the square and filling it. */
function squirclePath(): string {
  const half = SIZE / 2;
  const points: Array<string> = [];
  const steps = SQUIRCLE_STEPS * 4;
  for (let index = 0; index < steps; index++) {
    const angle = (index / steps) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = half + half * Math.sign(cos) * Math.abs(cos) ** (2 / SQUIRCLE_EXPONENT);
    const y = half + half * Math.sign(sin) * Math.abs(sin) ** (2 / SQUIRCLE_EXPONENT);
    points.push(`${index === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`);
  }
  return `${points.join('')}Z`;
}

/** The letter as outlines, its ink centred on the square. */
function letterPath(font: Font): string {
  const glyph = font.layout('a').glyphs[0];
  if (glyph === undefined) {
    throw new Error('The font has no glyph for "a"');
  }
  const box = glyph.path.bbox;
  const scale = (SIZE * INK_RATIO) / (box.maxY - box.minY);
  // Font units grow upwards, SVG units downwards: flip, then centre the ink.
  const offsetX = SIZE / 2 - ((box.minX + box.maxX) / 2) * scale;
  const offsetY = SIZE / 2 + ((box.minY + box.maxY) / 2) * scale;
  return glyph.path
    .transform(scale, 0, 0, -scale, offsetX, offsetY)
    .toSVG()
    .replaceAll(/-?\d+\.\d+/gu, (value: string) => String(round(Number(value))));
}

const face = openFont(fontFile);
if (!('layout' in face)) {
  throw new Error('Expected a single font, not a collection');
}
const letter = letterPath(face);
const squircle = squirclePath();

// Inverted in a dark browser: a black tab bar swallows a black tile, so the
// icon turns into white paper there and keeps its edges.
const faviconSvg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">`,
  `<style>.bg{fill:${BLACK}}.fg{fill:${WHITE}}`,
  `@media (prefers-color-scheme: dark){.bg{fill:${WHITE}}.fg{fill:${BLACK}}}</style>`,
  `<path class="bg" d="${squircle}"/>`,
  `<path class="fg" d="${letter}"/>`,
  '</svg>',
].join('');
writeFileSync(path.join(out, 'favicon.svg'), `${faviconSvg}\n`);
process.stdout.write(`render-brand: favicon.svg (${faviconSvg.length} bytes)\n`);

/** The light icon for the PNGs, with or without the squircle's transparent corners. */
const iconSvg = (fullBleed: boolean) =>
  [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="100%" height="100%">`,
    fullBleed
      ? `<rect width="${SIZE}" height="${SIZE}" fill="${BLACK}"/>`
      : `<path d="${squircle}" fill="${BLACK}"/>`,
    `<path d="${letter}" fill="${WHITE}"/>`,
    '</svg>',
  ].join('');

const reset =
  '* { margin: 0; padding: 0; box-sizing: border-box; } body { background: transparent; }';

// iOS cuts its own rounded corners into the touch icon, so that one is
// full-bleed; the tab icon keeps the squircle on a transparent square.
const pngs = [
  { file: 'favicon.png', fullBleed: false, size: 32 },
  { file: 'apple-touch-icon.png', fullBleed: true, size: 180 },
];

const fontFace = `@font-face {
  font-family: 'Suisse Intl';
  font-style: normal;
  font-weight: 500;
  src: url('data:font/woff2;base64,${readFileSync(fontFile).toString('base64')}') format('woff2');
}`;

const ogPage = `<style>${fontFace}${reset}
body { background: ${BLACK}; color: ${WHITE}; font-family: 'Suisse Intl'; font-weight: 500; height: 630px; overflow: hidden; position: relative; width: 1200px; -webkit-font-smoothing: antialiased; }
.top { align-items: baseline; display: flex; justify-content: space-between; left: 80px; position: absolute; right: 80px; top: 72px; }
.wordmark { font-size: 48px; letter-spacing: -0.02em; }
.domain { color: ${GRAY}; font-size: 26px; }
.tagline { bottom: 88px; font-size: 76px; left: 80px; letter-spacing: -0.03em; line-height: 1.08; position: absolute; right: 80px; text-wrap: balance; }
</style><div class="top"><div class="wordmark">angaria</div><div class="domain">${OG_DOMAIN}</div></div><div class="tagline">${OG_TAGLINE}</div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const png of pngs) {
  await page.setViewportSize({ height: png.size, width: png.size });
  await page.setContent(`<style>${reset} svg { display: block; }</style>${iconSvg(png.fullBleed)}`);
  await page.screenshot({ omitBackground: true, path: path.join(out, png.file) });
  process.stdout.write(`render-brand: ${png.file} (${png.size}x${png.size})\n`);
}

await page.setViewportSize({ height: 630, width: 1200 });
await page.setContent(ogPage);
// A string, so this Node-typed script needs no DOM types for one browser-side line.
await page.evaluate('document.fonts.ready');
await page.screenshot({ path: path.join(out, 'og.png') });
process.stdout.write('render-brand: og.png (1200x630)\n');

await browser.close();
