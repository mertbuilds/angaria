// @vitest-environment jsdom
import { Popover, PopoverContent, PopoverTrigger } from '@angaria/ui';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal(
  'ResizeObserver',
  class {
    disconnect() {}
    observe() {}
    unobserve() {}
  },
);

// jsdom has no layout: a 1024x768 viewport, a 32px trigger at `anchorTop`
// and a 240x200 popup, so Floating UI can tell which side has room.
let anchorTop = 0;
const isTrigger = (element: Element) => element.textContent === 'Aç';
const isPositioner = (element: Element) =>
  element.getAttribute('role') === 'presentation' && element.hasAttribute('data-side');

beforeEach(() => {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: 1024,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: 768,
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(
    function (this: HTMLElement) {
      return isPositioner(this) ? 240 : 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return isPositioner(this) ? 200 : 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      if (isTrigger(this)) {
        return DOMRect.fromRect({ height: 32, width: 80, x: 100, y: anchorTop });
      }
      return isPositioner(this)
        ? DOMRect.fromRect({ height: 200, width: 240 })
        : DOMRect.fromRect();
    },
  );
});

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.restoreAllMocks();
});

const render = (node: ReactNode) => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(node));
};

// Positioning settles in microtasks; the side is held from the next frame.
const nextFrame = () =>
  act(() => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve))));

const positioner = () => document.querySelector<HTMLElement>('[role="presentation"][data-side]');
const side = () => positioner()?.getAttribute('data-side');
const style = () => positioner()?.getAttribute('style');

const toggle = async () => {
  act(() => document.querySelector<HTMLElement>('button')?.click());
  await nextFrame();
};

// The page scrolls the trigger near the top: the popup now fits below too.
const scrollTriggerUp = async () => {
  anchorTop = 100;
  act(() => window.dispatchEvent(new Event('scroll')));
  await nextFrame();
};

test('an open popup keeps the side it opened on, and picks again on the next open', async () => {
  anchorTop = 700;
  render(
    <Popover>
      <PopoverTrigger>Aç</PopoverTrigger>
      <PopoverContent>İçerik</PopoverContent>
    </Popover>,
  );
  await toggle();
  expect(side()).toBe('top');
  const opened = style();

  // Positioned again against the moved trigger, still above it.
  await scrollTriggerUp();
  expect(style()).not.toBe(opened);
  expect(side()).toBe('top');

  // Closing and opening again picks the side from where the trigger is now.
  await toggle();
  await nextFrame();
  expect(side()).toBeUndefined();
  await toggle();
  expect(side()).toBe('bottom');
});
