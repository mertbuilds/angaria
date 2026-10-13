import { describe, expect, test } from 'vitest';
import {
  anchoredScroll,
  fitScale,
  formatZoom,
  gestureZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  PAGE_WIDTH,
  wheelDelta,
  wheelZoom,
  zoomIn,
  zoomOut,
  zoomScale,
} from '../src/lib/invoice-zoom.ts';

describe('fit', () => {
  test('fits the page to the width, never above actual size or below the least zoom', () => {
    expect(fitScale(PAGE_WIDTH / 2)).toBe(0.5);
    expect(fitScale(PAGE_WIDTH * 3)).toBe(1);
    expect(fitScale(10)).toBe(MIN_ZOOM);
  });

  test('fit follows the width until the user picks a scale', () => {
    expect(zoomScale('fit', 0.6)).toBe(0.6);
    expect(zoomScale(1.5, 0.6)).toBe(1.5);
  });
});

describe('steps', () => {
  test('⌘+ and ⌘- move to the neighboring step, from fit too', () => {
    expect(zoomIn('fit', 0.6)).toBe(0.67);
    expect(zoomOut('fit', 0.6)).toBe(0.5);
    expect(zoomIn(1, 1)).toBe(1.1);
    expect(zoomOut(1, 1)).toBe(0.9);
  });

  test('a scale a hair below a step goes past it', () => {
    expect(zoomIn(0.8999, 1)).toBe(1);
    expect(zoomOut(1.1001, 1)).toBe(1);
  });

  test('stops at the ends', () => {
    expect(zoomIn(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
    expect(zoomOut(MIN_ZOOM, 1)).toBe(MIN_ZOOM);
  });
});

describe('pinch', () => {
  test('a pinch out zooms in, a pinch in zooms out, within the limits', () => {
    expect(wheelZoom(1, -10)).toBeGreaterThan(1);
    expect(wheelZoom(1, 10)).toBeLessThan(1);
    expect(wheelZoom(MAX_ZOOM, -40)).toBe(MAX_ZOOM);
    expect(wheelZoom(MIN_ZOOM, 40)).toBe(MIN_ZOOM);
  });

  test('a mouse wheel notch moves about one step, not a jump', () => {
    expect(wheelZoom(1, wheelDelta(100, 0))).toBeCloseTo(Math.exp(-0.4));
    expect(wheelZoom(1, wheelDelta(3, 1))).toBeCloseTo(Math.exp(-0.4));
  });

  test('WebKit’s gesture scale multiplies the scale the pinch began at', () => {
    expect(gestureZoom(0.5, 2)).toBe(1);
    expect(gestureZoom(2, 10)).toBe(MAX_ZOOM);
  });
});

test('the percentage reads the Turkish way', () => {
  expect(formatZoom(0.857).replaceAll(/\s/g, '')).toBe('%86');
  expect(formatZoom(1).replaceAll(/\s/g, '')).toBe('%100');
});

test('a zoom keeps the page point under the pointer in place', () => {
  // The point 100px into the page at scale 1, 150px into the viewport.
  const anchor = { pageX: 100, pageY: 200, x: 150, y: 250 };
  expect(anchoredScroll(anchor, 2, { left: 24, top: 24 })).toEqual({ left: 74, top: 174 });
  // Zoomed out the page centers and the scroll position stays at the start.
  expect(anchoredScroll(anchor, 0.5, { left: 300, top: 24 })).toEqual({ left: 200, top: 0 });
});
