// @vitest-environment jsdom
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@angaria/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';

// A menu item's `shortcut` shows its key and picks it while the menu is open.

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal(
  'ResizeObserver',
  class {
    disconnect() {}
    observe() {}
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
});

function renderMenu(onValueChange: (value: string) => void) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root?.render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Dönem</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup onValueChange={onValueChange} value="bu-ay">
            <DropdownMenuRadioItem shortcut="A" value="bu-ay">
              Bu ay
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem shortcut="G" value="gecen-ay">
              Geçen ay
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem shortcut="Ö" value="ozel">
              Özel
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    ),
  );
}

const press = (key: string, init: KeyboardEventInit = {}) => {
  const menu = document.querySelector('[role="menu"]');
  if (!menu) {
    throw new Error('The menu is not open');
  }
  act(() => {
    menu.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key, ...init }));
  });
};

test('shows each shortcut as a key at the end of its row', () => {
  renderMenu(() => {});
  const item = document.querySelector('[role="menuitemradio"][aria-keyshortcuts="G"]');
  expect(item?.querySelector('kbd')?.textContent).toBe('G');
});

test('a shortcut key picks its item, in either case', () => {
  const onValueChange = vi.fn();
  renderMenu(onValueChange);
  press('g');
  expect(onValueChange).toHaveBeenCalledWith('gecen-ay', expect.anything());
});

test('a key with marks also answers to its plain letter', () => {
  const onValueChange = vi.fn();
  renderMenu(onValueChange);
  press('o');
  expect(onValueChange).toHaveBeenCalledWith('ozel', expect.anything());
});

test('a key with a modifier, or one no item shows, picks nothing', () => {
  const onValueChange = vi.fn();
  renderMenu(onValueChange);
  press('g', { metaKey: true });
  press('x');
  expect(onValueChange).not.toHaveBeenCalled();
});
