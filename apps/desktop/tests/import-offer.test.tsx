// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ImportFromGIBProvider } from '../src/shell/import-from-gib.tsx';

// The Faturalardan içe aktar offer after a company's first GİB login: a login
// while the window is hidden (an agent over MCP) waits for the window.

const mocks = vi.hoisted(() => ({
  dialog: vi.fn<(props: { onboarding: boolean; open: boolean }) => null>(() => null),
  listeners: new Set<(username: string) => void>(),
  markImportOffered: vi.fn<(entityId: string) => void>(),
}));

vi.mock('../src/lib/gib.ts', () => ({
  onGIBLogin: (listener: (username: string) => void) => {
    mocks.listeners.add(listener);
    return () => mocks.listeners.delete(listener);
  },
}));
vi.mock('../src/lib/store.tsx', () => ({
  useStore: () => ({
    activeEntity: { creds: { username: '12345678' }, id: 'company', importOffered: false },
    activeEntityId: 'company',
    markImportOffered: mocks.markImportOffered,
  }),
}));
vi.mock('../src/pages/import-from-gib.tsx', () => ({ ImportFromGIBDialog: mocks.dialog }));
vi.mock('../src/shell/credentials-guard.tsx', () => ({ useRequireCredentials: () => () => true }));
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: '/faturalar' } }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let visibility: DocumentVisibilityState = 'visible';
let root: Root | null = null;

beforeEach(() => {
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  mocks.dialog.mockClear();
  mocks.markImportOffered.mockClear();
  root = createRoot(document.createElement('div'));
  act(() => root?.render(<ImportFromGIBProvider>{null}</ImportFromGIBProvider>));
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
});

const login = (username: string) =>
  act(() => {
    for (const listener of mocks.listeners) {
      listener(username);
    }
  });

const setVisibility = (next: DocumentVisibilityState) =>
  act(() => {
    visibility = next;
    document.dispatchEvent(new Event('visibilitychange'));
  });

const dialogOpen = () => mocks.dialog.mock.lastCall?.[0].open ?? false;

test('a login in a visible window offers the import and marks it offered', () => {
  login('12345678');
  expect(dialogOpen()).toBe(true);
  expect(mocks.markImportOffered).toHaveBeenCalledWith('company');
});

test('a login while the window is hidden waits until the window shows', () => {
  setVisibility('hidden');
  login('12345678');
  expect(dialogOpen()).toBe(false);
  expect(mocks.markImportOffered).not.toHaveBeenCalled();

  setVisibility('visible');
  expect(dialogOpen()).toBe(true);
  expect(mocks.markImportOffered).toHaveBeenCalledOnce();
});

test("another company's login is never offered", () => {
  setVisibility('hidden');
  login('87654321');
  setVisibility('visible');
  expect(dialogOpen()).toBe(false);
  expect(mocks.markImportOffered).not.toHaveBeenCalled();
});
