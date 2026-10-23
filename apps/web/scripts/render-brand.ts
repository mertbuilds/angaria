import { readFileSync } from 'node:fs';
import path from 'node:path';
/**
 * Renders the site's share image, public/og.png (1200x630), in the layout of
 * Agent Caffeine's (caffeinagent.com): the app icon and name at the top, the
 * hero's headline large over two lines with "7 gün ücretsiz dene" in the
 * brand blue under it. No link and no small print: a share image is read
 * at a glance. Real
 * Suisse Intl Medium; the PNG is a screenshot of a headless Chromium page. The
 * woff2 files are gitignored (`pnpm fonts`), so run this where they have been
 * fetched. The icons themselves come from `pnpm icons`.
 *
 *   pnpm --filter web brand
 */
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public');
const fontFile = path.resolve(root, '../../packages/ui/fonts/SuisseIntl-Medium.woff2');
const iconFile = path.resolve(root, '../desktop/src-tauri/icons/source/angaria-icon.png');

const messages = JSON.parse(readFileSync(path.join(root, 'messages/tr.json'), 'utf8')) as Record<
  string,
  string
>;
const headline = messages['hero_title'];
if (headline === undefined) {
  throw new Error('messages/tr.json has no hero_title');
}
// "GİB portalıyla uğraşma, faturanı Mac'inden kes": a line for each clause.
const [first, second] = headline.split(/,\s*/);

const dataUrl = (file: string, type: string) =>
  `data:${type};base64,${readFileSync(file).toString('base64')}`;

// The brand blue that reads as text on white (brand.css --brand-ink, 5.6:1).
const ogPage = `<style>
@font-face { font-family: 'Suisse Intl'; font-weight: 500; src: url('${dataUrl(fontFile, 'font/woff2')}') format('woff2'); }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #ffffff; color: #000000; display: flex; flex-direction: column; font-family: 'Suisse Intl'; font-weight: 500; height: 630px; overflow: hidden; padding: 64px 72px; position: relative; width: 1200px; -webkit-font-smoothing: antialiased; }
.dots { background-image: radial-gradient(circle, rgb(0 0 0 / 0.14) 1.2px, transparent 1.7px); background-size: 26px 26px; inset: 0; mask-image: linear-gradient(to bottom, transparent, #000 60%); position: absolute; }
.brand { align-items: center; display: flex; font-size: 30px; gap: 16px; letter-spacing: -0.01em; position: relative; }
.brand img { height: 52px; width: 52px; }
.headline { font-size: 78px; margin-block: auto; letter-spacing: -0.03em; line-height: 1.06; position: relative; }
.headline .blue { color: #006abb; }
</style><div class="dots"></div>
<div class="brand"><img src="${dataUrl(iconFile, 'image/png')}" alt="">Angaria</div>
<div class="headline">${first},<br>${second}<br><span class="blue">7 gün ücretsiz dene</span></div>
`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { height: 630, width: 1200 },
  });
  await page.setContent(ogPage);
  // A string, so this Node-typed script needs no DOM types for one browser-side line.
  await page.evaluate('document.fonts.ready');
  await page.screenshot({ path: path.join(out, 'og.png') });
  process.stdout.write('render-brand: og.png (1200x630)\n');
} finally {
  await browser.close();
}
