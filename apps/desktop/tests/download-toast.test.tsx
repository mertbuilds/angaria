// @vitest-environment jsdom
import { toast, Toaster } from '@angaria/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  DOWNLOAD_TOAST_DURATION,
  splitFileName,
  toastDownloaded,
  toastPreparing,
} from '../src/lib/download-toast.tsx';

const opener = vi.hoisted(() => ({
  openPath: vi.fn(async (_path: string) => {}),
  revealItemInDir: vi.fn(async (_path: string) => {}),
}));
vi.mock('@tauri-apps/plugin-opener', () => opener);

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
// Sonner's "system" theme asks for the color scheme.
vi.stubGlobal('matchMedia', (query: string) => ({
  addEventListener() {},
  addListener() {},
  matches: false,
  media: query,
  removeEventListener() {},
  removeListener() {},
}));

const NAME = 'e-Arsiv-Fatura-2026-03-05-Ana-Varlık-ACME-GmbH-GIB2026000000001 (2).pdf';
const PATH = `/Users/mert/Downloads/${NAME}`;

let root: Root | null = null;
let host: HTMLElement | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<Toaster />));
});

afterEach(() => {
  act(() => {
    toast.dismiss();
    vi.runAllTimers();
  });
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.useRealTimers();
  opener.openPath.mockClear();
  opener.revealItemInDir.mockClear();
});

const toasts = () => [...document.querySelectorAll<HTMLElement>('[data-sonner-toast]')];
const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[data-sonner-toast] button')].find(
    (element) => element.textContent === name || element.getAttribute('aria-label') === name,
  );

// Sonner renders each toast call on a timer: the loading toast shows first,
// then turns into the saved file.
const showDownloaded = (path: string | null = PATH) => {
  let id: number | string = '';
  act(() => {
    id = toastPreparing('PDF hazırlanıyor…');
    vi.advanceTimersByTime(0);
  });
  act(() => {
    toastDownloaded(id, 'PDF kaydedildi', { name: NAME, path });
    vi.advanceTimersByTime(0);
  });
};

test('keeps the end of a long file name whole and cuts before it', () => {
  expect(splitFileName(NAME)).toEqual([
    'e-Arsiv-Fatura-2026-03-05-Ana-Varlık-ACME-GmbH-',
    'GIB2026000000001 (2).pdf',
  ]);
  expect(splitFileName('Fatura.pdf')).toEqual(['', 'Fatura.pdf']);
  // Characters, not UTF-16 units: a Turkish letter is never split.
  expect(splitFileName(`${'ı'.repeat(30)}.pdf`)).toEqual(['ı'.repeat(10), `${'ı'.repeat(20)}.pdf`]);
});

test('turns the loading toast into the saved file, its name and its two actions', () => {
  showDownloaded();

  expect(toasts()).toHaveLength(1);
  const [shown] = toasts();
  expect(shown.dataset.type).toBe('success');
  expect(shown.querySelector('[data-title]')?.textContent).toBe('PDF kaydedildi');
  // The whole name is in the text, cut only by CSS, and in the tooltip.
  const description = shown.querySelector('[data-description]');
  expect(description?.textContent).toBe(NAME);
  expect(description?.querySelector('[title]')?.getAttribute('title')).toBe(NAME);

  expect(button('Finder’da göster')?.matches('[data-action]')).toBe(true);
  expect(button('Aç')?.matches('[data-cancel]')).toBe(true);
  expect(button('Kapat')?.matches('[data-close-button]')).toBe(true);
});

test('announces politely, in a region the keyboard reaches', () => {
  showDownloaded();

  const region = document.querySelector('section[aria-live]');
  expect(region?.getAttribute('aria-live')).toBe('polite');
  expect(region?.getAttribute('aria-label')).toMatch(/^Bildirimler /);
  for (const name of ['Finder’da göster', 'Aç', 'Kapat']) {
    expect(button(name)?.tabIndex).toBe(0);
  }
});

test('Finder’da göster reveals the file and closes the toast', async () => {
  showDownloaded();

  await act(async () => button('Finder’da göster')?.click());

  expect(opener.revealItemInDir).toHaveBeenCalledWith(PATH);
  expect(opener.openPath).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(500));
  expect(toasts()).toHaveLength(0);
});

test('Aç opens the file in its default app', async () => {
  showDownloaded();

  await act(async () => button('Aç')?.click());

  expect(opener.openPath).toHaveBeenCalledWith(PATH);
  expect(opener.revealItemInDir).not.toHaveBeenCalled();
});

test('a file moved away since shows an error instead', async () => {
  opener.revealItemInDir.mockRejectedValueOnce(new Error('No such file or directory'));
  showDownloaded();

  await act(async () => button('Finder’da göster')?.click());
  act(() => vi.advanceTimersByTime(0));

  const error = toasts().find((element) => element.dataset.type === 'error');
  expect(error?.querySelector('[data-title]')?.textContent).toBe(
    'Dosya Finder’da gösterilemedi. Taşınmış ya da silinmiş olabilir.',
  );
});

test('stays twice as long as a plain toast, counted from the loading toast', () => {
  expect(DOWNLOAD_TOAST_DURATION).toBe(8000);
  showDownloaded();

  act(() => vi.advanceTimersByTime(DOWNLOAD_TOAST_DURATION - 500));
  expect(toasts()).toHaveLength(1);
  act(() => vi.advanceTimersByTime(1000));
  expect(toasts()).toHaveLength(0);
});

test('without a path (a plain browser) shows the name and no actions', () => {
  showDownloaded(null);

  expect(toasts()[0]?.querySelector('[data-description]')?.textContent).toBe(NAME);
  expect(button('Finder’da göster')).toBeUndefined();
  expect(button('Aç')).toBeUndefined();
  expect(button('Kapat')).toBeDefined();
});
