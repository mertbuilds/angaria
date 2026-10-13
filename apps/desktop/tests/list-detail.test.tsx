// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';
import { ListDetail } from '../src/shell/list-detail.tsx';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// Newer Node versions define their own localStorage global, which hides jsdom's.
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
});

// The split is 500px wide: the detail keeps 240, so the list has room for 260.
vi.stubGlobal(
  'ResizeObserver',
  class {
    callback: (entries: Array<{ contentRect: { width: number } }>) => void;
    constructor(callback: (entries: Array<{ contentRect: { width: number } }>) => void) {
      this.callback = callback;
    }
    disconnect() {}
    observe() {
      this.callback([{ contentRect: { width: 500 } }]);
    }
    unobserve() {}
  },
);

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  storage.clear();
});

test('a narrow window limits the list width the divider reports, moves and saves', () => {
  localStorage.setItem('list-width', '400');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<ListDetail detail={null} list={null} storageKey="list-width" />));

  const divider = document.querySelector<HTMLElement>('[role="separator"]');
  if (!divider) {
    throw new Error('No divider');
  }
  expect(divider.getAttribute('aria-valuenow')).toBe('260');
  expect(divider.getAttribute('aria-valuemax')).toBe('260');

  const press = (key: string) =>
    act(() => {
      divider.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }));
    });
  press('ArrowRight');
  expect(divider.getAttribute('aria-valuenow')).toBe('260');
  expect(localStorage.getItem('list-width')).toBe('260');
  // The first step left moves the list on screen at once.
  press('ArrowLeft');
  expect(divider.getAttribute('aria-valuenow')).toBe('244');
  expect(localStorage.getItem('list-width')).toBe('244');
});
