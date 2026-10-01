import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { stubObservers } from '../test/observers.ts';
import { createGrid, FlickeringGrid, stepGrid } from './flickering-grid.tsx';

/** A fixed sequence instead of Math.random, so the grid is the same every run. */
const sequence = (...values: Array<number>) => {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
};

describe('grid', () => {
  test('covers the area with squares no brighter than the maximum', () => {
    const grid = createGrid(64, 32, 0.2, sequence(0.5, 0.9, 0.3));
    expect(grid.cols * grid.rows).toBe(4 * 2);
    for (const opacity of grid.current) {
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(0.65);
    }
  });

  test('eases each square toward its new brightness instead of jumping', () => {
    const grid = createGrid(16, 16, 0.2, () => 0.5);
    grid.current[0] = 0;
    grid.target[0] = 0.2;

    // 0.99 never picks a new target, so only the easing runs.
    stepGrid(grid, 0.1, () => 0.99);
    const eased = grid.current[0] ?? 0;
    expect(eased).toBeGreaterThan(0);
    expect(eased).toBeLessThan(0.2);
  });
});

describe('FlickeringGrid', () => {
  const context = {
    canvas: { height: 0, width: 0 },
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  };
  let frames: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    vi.stubGlobal(
      'ResizeObserver',
      class {
        callback: ResizeObserverCallback;
        constructor(callback: ResizeObserverCallback) {
          this.callback = callback;
        }
        disconnect = vi.fn();
        observe = () =>
          this.callback(
            [{ contentRect: { height: 160, width: 320 } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
      },
    );
    frames = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('with reduced motion, draws the grid once and never animates', () => {
    const observers = stubObservers({ reducedMotion: true });
    render(<FlickeringGrid />);
    act(() => observers.intersect(true));

    expect(context.fillRect).toHaveBeenCalled();
    expect(frames).not.toHaveBeenCalled();
  });

  test('animates only while on screen', () => {
    const observers = stubObservers();
    render(<FlickeringGrid />);
    expect(frames).not.toHaveBeenCalled();

    act(() => observers.intersect(true));
    expect(frames).toHaveBeenCalledTimes(1);

    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    act(() => observers.intersect(false));
    expect(cancel).toHaveBeenCalled();
  });
});
