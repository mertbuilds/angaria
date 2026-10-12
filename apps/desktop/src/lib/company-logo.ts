// A company logo for the PDF: read from a PNG, JPG or SVG file, scaled down
// and stored as a PNG data URL (react-pdf draws PNG and JPG, not SVG).

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

/**
 * Largest file accepted. Only a guard against decoding a huge file: every logo
 * is scaled down to MAX_SIDE and stored as a small PNG anyway.
 */
const MAX_LOGO_FILE_BYTES = 10 * 1024 * 1024;

/** Longest side of the stored PNG: sharp in the PDF's 180 by 44 point box */
const MAX_SIDE = 800;

/**
 * Most pixels decoded. A small file can hold a huge image (a PNG of one color
 * compresses well), and decoding it takes 4 bytes a pixel.
 */
const MAX_LOGO_PIXELS = 25_000_000;

/** Fit `width` by `height` into `max` on the longest side, keeping the ratio. */
export function fitLogoSize(
  width: number,
  height: number,
  { max = MAX_SIDE, upscale = false } = {},
) {
  const longest = Math.max(width, height);
  const scale = upscale ? max / longest : Math.min(1, max / longest);
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

/** A length in user units ("120" or "120px"), else 0. */
const svgLength = (value: string | null) =>
  value && /^\s*\d+(\.\d+)?(px)?\s*$/.test(value) ? Number.parseFloat(value) : 0;

/**
 * The SVG `markup` drawn at MAX_SIDE: without a set size, browsers draw it
 * small. One with a width and height but no viewBox gets a viewBox of that
 * size, so its drawing scales with it.
 */
export function sizeSVG(markup: string) {
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const svg = parsed.documentElement;
  if (svg.nodeName !== 'svg') {
    throw new Error('SVG dosyası okunamadı. Başka bir dosya seç.');
  }
  const box = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  let [width, height] = box.length === 4 ? [box[2], box[3]] : [0, 0];
  if (!(width > 0 && height > 0)) {
    width = svgLength(svg.getAttribute('width'));
    height = svgLength(svg.getAttribute('height'));
    if (width > 0 && height > 0) {
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
  }
  if (width > 0 && height > 0) {
    const size = fitLogoSize(width, height, { upscale: true });
    svg.setAttribute('width', String(size.width));
    svg.setAttribute('height', String(size.height));
  }
  return new XMLSerializer().serializeToString(svg);
}

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/** A PNG's or JPEG's size from its header, without decoding it; null when unreadable. */
export function imageHeaderSize(bytes: Uint8Array): { height: number; width: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // PNG: the signature, then IHDR with the width and height.
  if (
    bytes.length >= 24 &&
    view.getUint32(0) === 0x89_50_4e_47 &&
    view.getUint32(12) === 0x49_48_44_52
  ) {
    return { height: view.getUint32(20), width: view.getUint32(16) };
  }
  // JPEG: the segments up to the first start of frame.
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  let at = 2;
  while (at + 9 <= bytes.length) {
    if (bytes[at] !== 0xff) {
      return null;
    }
    const marker = bytes[at + 1];
    if (marker === 0xff) {
      at += 1;
    } else if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
    } else if (SOF_MARKERS.has(marker)) {
      return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
    } else {
      at += 2 + view.getUint16(at + 2);
    }
  }
  return null;
}

/** The file to draw: an SVG sized for the canvas, a PNG or JPEG of a size safe to decode. */
async function drawable(file: File): Promise<Blob> {
  if (file.type === 'image/svg+xml') {
    return new Blob([sizeSVG(await file.text())], { type: 'image/svg+xml' });
  }
  const size = imageHeaderSize(new Uint8Array(await file.arrayBuffer()));
  if (!size) {
    throw new Error('Logo okunamadı. Başka bir dosya seç.');
  }
  if (size.width * size.height > MAX_LOGO_PIXELS) {
    throw new Error('Logo en fazla 25 megapiksel olabilir');
  }
  return file;
}

/** The logo in `file` as a PNG data URL; throws a message to show the user. */
export async function readLogo(file: File): Promise<string> {
  if (!LOGO_TYPES.includes(file.type)) {
    throw new Error('Logo PNG, JPG ya da SVG olmalı');
  }
  if (file.size > MAX_LOGO_FILE_BYTES) {
    throw new Error('Logo en fazla 10 megabayt olabilir');
  }
  const url = URL.createObjectURL(await drawable(file));
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error('Logo okunamadı. Başka bir dosya seç.');
    });
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('Logonun boyutu okunamadı. Başka bir dosya seç.');
    }
    const { height, width } = fitLogoSize(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Logo işlenemedi. Tekrar dene.');
    }
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
