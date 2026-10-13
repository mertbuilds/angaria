import { renderSVG } from 'uqr';

// GİB's preview HTML draws its QR code with an inline script: it reads the
// JSON in the hidden #qrvalue div and paints it into the empty #qrcode div.
// The preview iframe runs no scripts (sandbox="" and the app's CSP), so the
// code is drawn here instead and the scripts are dropped.

const QR_VALUE = /<div\b[^>]*\bid=["']?qrvalue["']?[^>]*>([\s\S]*?)<\/div>/i;
const QR_TARGET = /(<div\b[^>]*\bid=["']?qrcode["']?[^>]*>)\s*(<\/div>)/i;
const SCRIPT = /<script\b[\s\S]*?<\/script\s*>/gi;
const ENTITY = /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi;

const NAMED: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

function decodeEntities(text: string) {
  return text.replaceAll(ENTITY, (match, entity: string) => {
    const name = entity.toLowerCase();
    if (name.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    }
    if (name.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    }
    return NAMED[name] ?? match;
  });
}

/** The text GİB's QR code encodes (the #qrvalue JSON), or undefined without one. */
export function readQRValue(html: string): string | undefined {
  const value = QR_VALUE.exec(html)?.[1];
  return value?.trim() ? decodeEntities(value) : undefined;
}

/**
 * GİB's preview HTML with its QR code drawn as an SVG image (220px, error
 * correction H, as GİB draws it) and without scripts. HTML without a QR value
 * only loses its scripts.
 */
export function withQRCode(html: string): string {
  const withoutScripts = html.replaceAll(SCRIPT, '');
  const value = readQRValue(withoutScripts);
  if (!value) {
    return withoutScripts;
  }
  const svg = renderSVG(value, { border: 0, ecc: 'H' });
  const image = `<img alt="Karekod" height="220" width="220" src="data:image/svg+xml;base64,${btoa(svg)}">`;
  return withoutScripts.replace(
    QR_TARGET,
    (_, open: string, close: string) => open + image + close,
  );
}
