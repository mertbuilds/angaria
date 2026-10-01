import { colors } from '@angaria/ui/tokens.stylex';
import { create, props, type StyleXStyles } from '@stylexjs/stylex';
import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../lib/motion.ts';

/*
 * Ported from Flickering Grid by Dillion Verma (Magic UI), MIT license:
 * https://21st.dev/@dillionverma/components/flickering-grid
 * https://github.com/magicuidesign/magicui
 *
 * Changes from the original: a square eases toward its next brightness
 * instead of jumping to it, a few squares are the site's pale red, both colors
 * come from the theme and follow it, the loop draws at most 30 frames a second
 * and only while the grid is on screen, and reduced motion draws it once.
 */

/** One square every 16px: 4px squares on the canon's 4px grid. */
const CELL = 16;
const SQUARE = 4;
/** How often a square picks a new brightness, per second. */
const FLICKER = 0.35;
/** How fast a square closes in on its new brightness, per second. */
const EASE_RATE = 2.5;
/** The share of squares drawn in pale red, and how bright they may get. */
const BRAND_SHARE = 0.06;
const BRAND_MAX_OPACITY = 0.65;
const FRAME_MS = 1000 / 30;
const MAX_DPR = 2;

export interface Grid {
  /** 1 where the square is pale red. */
  brand: Uint8Array;
  cols: number;
  current: Float32Array;
  maxOpacity: number;
  rows: number;
  target: Float32Array;
}

type Random = () => number;

const brightness = (grid: Grid, index: number, random: Random) =>
  random() * (grid.brand[index] ? BRAND_MAX_OPACITY : grid.maxOpacity);

/** A grid that covers `width` by `height` CSS pixels, every square at a random brightness. */
export function createGrid(
  width: number,
  height: number,
  maxOpacity: number,
  random: Random = Math.random,
): Grid {
  const cols = Math.ceil(width / CELL);
  const rows = Math.ceil(height / CELL);
  const count = cols * rows;
  const grid: Grid = {
    brand: new Uint8Array(count),
    cols,
    current: new Float32Array(count),
    maxOpacity,
    rows,
    target: new Float32Array(count),
  };
  for (let index = 0; index < count; index++) {
    grid.brand[index] = random() < BRAND_SHARE ? 1 : 0;
    grid.current[index] = brightness(grid, index, random);
    grid.target[index] = grid.current[index] ?? 0;
  }
  return grid;
}

/** Moves the grid `seconds` forward: some squares pick a new brightness, all ease toward theirs. */
export function stepGrid(grid: Grid, seconds: number, random: Random = Math.random) {
  const ease = 1 - Math.exp(-seconds * EASE_RATE);
  for (let index = 0; index < grid.current.length; index++) {
    if (random() < FLICKER * seconds) {
      grid.target[index] = brightness(grid, index, random);
    }
    const current = grid.current[index] ?? 0;
    grid.current[index] = current + ((grid.target[index] ?? 0) - current) * ease;
  }
}

interface Palette {
  brand: string;
  ink: string;
}

/** The theme's colors as the canvas sees them: its own text color and --brand. */
function readPalette(canvas: HTMLCanvasElement): Palette {
  const style = getComputedStyle(canvas);
  return { brand: style.getPropertyValue('--brand').trim() || style.color, ink: style.color };
}

function drawGrid(
  context: CanvasRenderingContext2D,
  grid: Grid,
  palette: Palette,
  pixelRatio: number,
) {
  const cell = CELL * pixelRatio;
  const square = SQUARE * pixelRatio;
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  // Two passes, one fill color each, so the color is set twice per frame.
  for (const isBrand of [0, 1]) {
    context.fillStyle = isBrand ? palette.brand : palette.ink;
    for (let col = 0; col < grid.cols; col++) {
      for (let row = 0; row < grid.rows; row++) {
        const index = col * grid.rows + row;
        const opacity = grid.current[index] ?? 0;
        if (grid.brand[index] === isBrand && opacity > 0.01) {
          context.globalAlpha = opacity;
          context.fillRect(col * cell, row * cell, square, square);
        }
      }
    }
  }
  context.globalAlpha = 1;
}

const styles = create({
  canvas: {
    color: colors.fg,
    display: 'block',
    height: '100%',
    pointerEvents: 'none',
    width: '100%',
  },
});

/**
 * A field of small squares that slowly brighten and fade, ink colored with a
 * few pale red ones. Fills its box; size and mask it with `style`.
 */
export function FlickeringGrid({
  maxOpacity = 0.14,
  style,
}: {
  maxOpacity?: number;
  style?: StyleXStyles | undefined;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    const still = prefersReducedMotion();
    let grid: Grid | null = null;
    let palette = readPalette(canvas);
    let pixelRatio = 1;
    let frame = 0;
    let last = 0;
    let visible = typeof IntersectionObserver === 'undefined';

    const render = () => {
      if (grid) {
        drawGrid(context, grid, palette, pixelRatio);
      }
    };

    const resize = (width: number, height: number) => {
      pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      grid = createGrid(width, height, maxOpacity);
      render();
    };

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      if (time - last < FRAME_MS || !grid) {
        return;
      }
      // A long gap (a background tab) counts as one frame, not a jump.
      const seconds = last === 0 ? 0 : Math.min((time - last) / 1000, 0.1);
      last = time;
      stepGrid(grid, seconds);
      render();
    };

    const start = () => {
      if (!still && visible && frame === 0) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const onThemeChange = () => {
      palette = readPalette(canvas);
      render();
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'undefined') {
      resize(canvas.clientWidth, canvas.clientHeight);
    } else {
      resizeObserver = new ResizeObserver(([entry]) => {
        if (entry) {
          resize(entry.contentRect.width, entry.contentRect.height);
        }
      });
      resizeObserver.observe(canvas);
    }

    let intersectionObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting ?? false;
        if (visible) {
          start();
        } else {
          stop();
        }
      });
      intersectionObserver.observe(canvas);
    }
    start();

    const scheme = window.matchMedia?.('(prefers-color-scheme: dark)');
    scheme?.addEventListener('change', onThemeChange);
    const themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(document.documentElement, { attributeFilter: ['data-theme'] });

    return () => {
      stop();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      scheme?.removeEventListener('change', onThemeChange);
      themeObserver.disconnect();
    };
  }, [maxOpacity]);

  return <canvas aria-hidden="true" ref={canvasRef} {...props(styles.canvas, style)} />;
}
