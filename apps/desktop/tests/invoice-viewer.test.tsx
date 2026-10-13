// @vitest-environment jsdom
import { create, props } from '@stylexjs/stylex';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';
import { InvoiceViewer } from '../src/pages/invoice-viewer.tsx';
import { shell } from '../src/shell/shell.stylex.ts';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal(
  'ResizeObserver',
  class {
    disconnect() {}
    observe() {}
    unobserve() {}
  },
);
// jsdom has no scrolling: a zoom scrolls to keep its anchor in place, and
// fitting to width scrolls back to the top.
const scrollTo = vi.fn();
Element.prototype.scrollTo = scrollTo;

// The shell's titlebar geometry: its height, and room for the traffic lights.
const expected = create({
  titlebar: {
    height: shell.toolbarHeight,
    paddingInlineStart: shell.trafficLightsInset,
  },
});

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  scrollTo.mockClear();
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const renderViewer = () => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root?.render(
      <InvoiceViewer
        downloads={<button type="button">İndir</button>}
        html="<p>Fatura</p>"
        onOpenChange={() => {}}
        open
        title="AGENT CAFFEINE INC · GIB202600000041"
      />,
    ),
  );
};

const viewerBar = () => {
  const title = document.querySelector('[role="dialog"] h2');
  if (!title?.parentElement) {
    throw new Error('The viewer has no title');
  }
  return { bar: title.parentElement, title };
};

test('the full-screen viewer’s bar reserves the titlebar and drags the window', () => {
  renderViewer();
  const { bar, title } = viewerBar();

  const classes = bar.className.split(' ');
  for (const name of props(expected.titlebar).className?.split(' ') ?? []) {
    expect(classes).toContain(name);
  }
  expect(bar.hasAttribute('data-tauri-drag-region')).toBe(true);
  expect(title.hasAttribute('data-tauri-drag-region')).toBe(true);

  // Every control sits in the bar and none of them drags the window.
  const buttons = [...bar.querySelectorAll('button')];
  expect(buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual([
    'Uzaklaştır',
    'Yakınlaştır',
    'Genişliğe sığdır',
    'İndir',
    'Kapat',
  ]);
  for (const button of buttons) {
    expect(button.hasAttribute('data-tauri-drag-region')).toBe(false);
  }

  // The page lies below the bar, not in it.
  expect(bar.querySelector('iframe')).toBeNull();
  expect(document.querySelector('[role="dialog"] iframe')).not.toBeNull();
});

test('a zoom scales the page only, never the viewer or its bar', () => {
  renderViewer();
  const { bar } = viewerBar();
  const frame = bar.parentElement;
  const popup = document.querySelector('[role="dialog"]');
  const page = document.querySelector('[role="dialog"] iframe')?.parentElement;
  const layout = () =>
    [popup, frame, bar].map((element) => [element?.className, element?.getAttribute('style')]);
  const before = layout();
  const pageBefore = page?.getAttribute('style');

  const zoomIn = bar.querySelector<HTMLElement>('[aria-label="Yakınlaştır"]');
  for (let step = 0; step < 3; step++) {
    act(() => zoomIn?.click());
  }
  // A pinch over the bar zooms the page too, and never the window.
  const pinch = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    deltaY: -40,
  });
  act(() => bar.dispatchEvent(pinch));
  expect(pinch.defaultPrevented).toBe(true);

  expect(bar.querySelector('[role="group"] span')?.textContent).toBe('%224');
  expect(page?.getAttribute('style')).not.toBe(pageBefore);
  expect(layout()).toEqual(before);
});

test('fit to width also goes back to the top, so it stays on while the page is scrolled', () => {
  renderViewer();
  const { bar } = viewerBar();
  const fit = bar.querySelector<HTMLButtonElement>('[aria-label="Genişliğe sığdır"]');
  const scroller = document.querySelector('[role="dialog"] iframe')?.parentElement?.parentElement;
  if (!fit || !scroller) {
    throw new Error('The viewer has no fit button or scroller');
  }
  expect(fit.disabled).toBe(true);

  Object.defineProperty(scroller, 'scrollTop', { configurable: true, value: 400 });
  act(() => scroller.dispatchEvent(new Event('scroll')));
  expect(fit.disabled).toBe(false);

  act(() => fit.click());
  expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'instant', left: 0, top: 0 });
  expect(scrollTo.mock.contexts.at(-1)).toBe(scroller);

  // ⌘0 (Ctrl+0 off macOS) does the same.
  scrollTo.mockClear();
  act(() =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: '0' }),
    ),
  );
  expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'instant', left: 0, top: 0 });

  Object.defineProperty(scroller, 'scrollTop', { configurable: true, value: 0 });
  act(() => scroller.dispatchEvent(new Event('scroll')));
  expect(fit.disabled).toBe(true);
});
