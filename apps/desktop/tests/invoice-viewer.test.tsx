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
        title="PLASTIC SOFTWARE LLC · GIB202600000041"
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
