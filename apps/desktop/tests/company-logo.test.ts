// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { fitLogoSize, imageHeaderSize, sizeSVG } from '../src/lib/company-logo.ts';

test('fitLogoSize scales the longest side down to the limit, keeping the ratio', () => {
  expect(fitLogoSize(1600, 400)).toEqual({ height: 200, width: 800 });
  expect(fitLogoSize(300, 1200)).toEqual({ height: 800, width: 200 });
  expect(fitLogoSize(400, 100)).toEqual({ height: 100, width: 400 });
  expect(fitLogoSize(4000, 1)).toEqual({ height: 1, width: 800 });
});

test('fitLogoSize scales up when asked (an SVG drawn sharp)', () => {
  expect(fitLogoSize(120, 30, { upscale: true })).toEqual({ height: 200, width: 800 });
  expect(fitLogoSize(120, 30, { max: 240, upscale: true })).toEqual({ height: 60, width: 240 });
});

test('imageHeaderSize reads a PNG and a JPEG size without decoding', () => {
  // A 1 by 1 pixel PNG
  const png = Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    ),
    (char) => char.codePointAt(0)!,
  );
  expect(imageHeaderSize(png)).toEqual({ height: 1, width: 1 });
  // The same header claiming 30000 by 30000
  const huge = png.slice();
  new DataView(huge.buffer).setUint32(16, 30_000);
  new DataView(huge.buffer).setUint32(20, 30_000);
  expect(imageHeaderSize(huge)).toEqual({ height: 30_000, width: 30_000 });
  // JPEG: SOI, an APP0 segment, then SOF0 with height 600 and width 1200
  const jpeg = Uint8Array.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x04,
    0xb0, 0x03,
  ]);
  expect(imageHeaderSize(jpeg)).toEqual({ height: 600, width: 1200 });
  // Stray bytes after a segment are skipped, as libjpeg and ImageIO do.
  const padded = Uint8Array.from([...jpeg.slice(0, 8), 0x00, 0x0a, ...jpeg.slice(8)]);
  expect(imageHeaderSize(padded)).toEqual({ height: 600, width: 1200 });
  expect(imageHeaderSize(new Uint8Array([1, 2, 3]))).toBeNull();
});

test('sizeSVG sizes an SVG that has a width and height but no viewBox', () => {
  const svg = new DOMParser().parseFromString(
    sizeSVG('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="10"><rect/></svg>'),
    'image/svg+xml',
  ).documentElement;
  expect(svg.getAttribute('viewBox')).toBe('0 0 40 10');
  expect(svg.getAttribute('width')).toBe('800');
  expect(svg.getAttribute('height')).toBe('200');
});
