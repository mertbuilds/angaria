import { readFileSync } from 'node:fs';
import path from 'node:path';
/**
 * Renders the site's share image, public/og.png (1200x630), with the real
 * Suisse Intl Medium: the hero's dot grid, the app icon, the wordmark and the
 * hero's headline. The PNG is a screenshot of a headless Chromium page. The
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
const tagline = messages['hero_title'];
if (tagline === undefined) {
  throw new Error('messages/tr.json has no hero_title');
}

const dataUrl = (file: string, type: string) =>
  `data:${type};base64,${readFileSync(file).toString('base64')}`;

// The hero's grid (src/components/hero.tsx): the text color at 24%, 22px
// apart, faded toward the edges and almost away behind the words.
const ogPage = `<style>
@font-face { font-family: 'Suisse Intl'; font-weight: 500; src: url('${dataUrl(fontFile, 'font/woff2')}') format('woff2'); }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { align-items: center; background: #ffffff; color: #000000; display: flex; flex-direction: column; font-family: 'Suisse Intl'; font-weight: 500; height: 630px; justify-content: center; overflow: hidden; position: relative; width: 1200px; -webkit-font-smoothing: antialiased; }
.dots { background-image: radial-gradient(circle, rgb(0 0 0 / 0.24) 1.2px, transparent 1.7px); background-position: 50% 50%; background-size: 26px 26px; inset: 0; mask-composite: intersect; mask-image: radial-gradient(56% 64% at 50% 50%, #000 40%, transparent 100%), radial-gradient(34% 30% at 50% 66%, rgb(0 0 0 / 0.15), #000); position: absolute; }
.icon { display: block; height: 176px; position: relative; width: 176px; }
.wordmark { font-size: 64px; letter-spacing: -0.02em; line-height: 1; margin-top: 36px; position: relative; }
.tagline { font-size: 34px; letter-spacing: -0.02em; line-height: 1.2; margin-top: 24px; position: relative; text-align: center; color: #555555; }
</style><div class="dots"></div><img class="icon" src="${dataUrl(iconFile, 'image/png')}" alt=""><div class="wordmark">angaria</div><div class="tagline">${tagline}</div>`;

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
