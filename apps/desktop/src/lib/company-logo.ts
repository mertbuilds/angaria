// A company logo for the PDF: read from a PNG, JPG or SVG file, scaled down
// and stored as a PNG data URL (react-pdf draws PNG and JPG, not SVG).

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

/** Largest file accepted */
const MAX_LOGO_FILE_BYTES = 1024 * 1024;

/** Longest side of the stored PNG: sharp in the PDF's 180 by 44 point box */
const MAX_SIDE = 800;

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

/** An SVG drawn at MAX_SIDE: without a set size, browsers draw it small. */
async function sizedSVG(file: File) {
  const parsed = new DOMParser().parseFromString(await file.text(), 'image/svg+xml');
  const svg = parsed.documentElement;
  if (svg.nodeName !== 'svg') {
    throw new Error('SVG dosyası okunamadı. Başka bir dosya seç.');
  }
  const box = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const [width, height] = box.length === 4 ? [box[2], box[3]] : [0, 0];
  if (width > 0 && height > 0) {
    const size = fitLogoSize(width, height, { upscale: true });
    svg.setAttribute('width', String(size.width));
    svg.setAttribute('height', String(size.height));
  }
  return new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
}

/** The logo in `file` as a PNG data URL; throws a message to show the user. */
export async function readLogo(file: File): Promise<string> {
  if (!LOGO_TYPES.includes(file.type)) {
    throw new Error('Logo PNG, JPG ya da SVG olmalı');
  }
  if (file.size > MAX_LOGO_FILE_BYTES) {
    throw new Error('Logo en fazla 1 megabayt olabilir');
  }
  const url = URL.createObjectURL(file.type === 'image/svg+xml' ? await sizedSVG(file) : file);
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
