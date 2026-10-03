// The invoice viewer's zoom: the page fits the pane's width until the user
// zooms; ⌘+ and ⌘- step through ZOOM_STEPS, pinch and ⌘ wheel scale freely.
// No React or DOM imports, so tests run it directly.

/** GİB lays the invoice out 800px wide; with its margins the page is 840. */
export const PAGE_WIDTH = 840;
/** The page's least height: A4's proportions at PAGE_WIDTH. */
export const PAGE_MIN_HEIGHT = Math.round(PAGE_WIDTH * Math.SQRT2);

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const ZOOM_STEPS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4,
] as const;

/** 'fit' follows the available width; a number is a scale the user chose. */
export type Zoom = 'fit' | number;

const clamp = (scale: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));

/** The scale that fits the page into `width` px, never above actual size. */
export const fitScale = (width: number) => clamp(Math.min(1, width / PAGE_WIDTH));

export const zoomScale = (zoom: Zoom, fit: number) => (zoom === 'fit' ? fit : zoom);

/** Steps a hair apart count as the same, so 0.9 after a pinch to 0.8999 goes to 1. */
const EPSILON = 0.005;

/** ⌘+: the next step above the current scale. */
export const zoomIn = (zoom: Zoom, fit: number): number => {
  const current = zoomScale(zoom, fit);
  return ZOOM_STEPS.find((step) => step > current + EPSILON) ?? MAX_ZOOM;
};

/** ⌘-: the next step below the current scale. */
export const zoomOut = (zoom: Zoom, fit: number): number => {
  const current = zoomScale(zoom, fit);
  return ZOOM_STEPS.findLast((step) => step < current - EPSILON) ?? MIN_ZOOM;
};

/** Wheel deltas in px: a line is 16, a page the page's width. */
export const wheelDelta = (deltaY: number, deltaMode: number) =>
  deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? PAGE_WIDTH : 1);

/**
 * Pinch (⌘ or Ctrl wheel, which trackpads send for a pinch): small deltas
 * scale smoothly, a mouse wheel's notch moves about one step.
 */
export const wheelZoom = (scale: number, delta: number) =>
  clamp(scale * Math.exp(-Math.max(-40, Math.min(40, delta)) / 100));

/** WebKit's gesture events: the pinch's scale since it began. */
export const gestureZoom = (startScale: number, gestureScale: number) =>
  clamp(startScale * gestureScale);

const percent = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0, style: 'percent' });

/** "%86", as Turkish writes a percentage. */
export const formatZoom = (scale: number) => percent.format(scale);

/**
 * Where to scroll after a zoom so the page point under (x, y) stays there:
 * `point` is in the viewport, `offset` the page's offset in the scroller.
 */
export function anchoredScroll(
  anchor: { pageX: number; pageY: number; x: number; y: number },
  scale: number,
  offset: { left: number; top: number },
) {
  return {
    left: Math.max(0, anchor.pageX * scale + offset.left - anchor.x),
    top: Math.max(0, anchor.pageY * scale + offset.top - anchor.y),
  };
}
