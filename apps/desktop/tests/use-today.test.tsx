// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useToday } from '../src/lib/use-today.ts';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 13, 23, 59, 0));
});
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  vi.useRealTimers();
});

function Today() {
  return <>{useToday().toString()}</>;
}

function mount() {
  const container = document.createElement('div');
  root = createRoot(container);
  act(() => root?.render(<Today />));
  return container;
}

test('turns over to the new day at midnight', () => {
  const container = mount();
  expect(container.textContent).toBe('2026-10-13');
  act(() => vi.advanceTimersByTime(2 * 60 * 1000));
  expect(container.textContent).toBe('2026-10-14');
});

test('reads the new day when the window gets the focus after a sleep', () => {
  const container = mount();
  // The clock jumps while the timer has not fired (a Mac asleep).
  vi.setSystemTime(new Date(2026, 9, 15, 9, 0, 0));
  act(() => window.dispatchEvent(new Event('focus')));
  expect(container.textContent).toBe('2026-10-15');
});
