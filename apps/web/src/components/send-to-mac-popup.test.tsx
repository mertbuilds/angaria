import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeSendToMac } from '../lib/send-to-mac.ts';
import { DownloadButton } from './cta.tsx';
import { SendToMacPopup } from './send-to-mac-popup.tsx';

vi.mock('../lib/analytics.ts', () => ({ track: vi.fn() }));

const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

function device(userAgent: string, maxTouchPoints: number) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: maxTouchPoints });
}

/** A download button and the page's popup, as every page has them. */
function renderPage() {
  render(
    <>
      <DownloadButton location="hero" />
      <SendToMacPopup />
    </>,
  );
  return screen.getByRole('link', { name: 'Mac için indir' });
}

/** Clicks the link and says whether the browser would have followed it. */
function click(link: HTMLElement) {
  let followed = true;
  act(() => {
    followed = fireEvent.click(link);
  });
  return followed;
}

beforeEach(() => {
  // jsdom has no modal dialogs: open and close them as a browser would.
  Object.assign(HTMLDialogElement.prototype, {
    close(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
    showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
});

afterEach(() => {
  act(() => closeSendToMac());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
});

describe('download off a Mac', () => {
  test('the link is the installer, with or without JavaScript', () => {
    device(IPHONE, 5);
    expect(renderPage()).toHaveAttribute('href', 'https://dl.angaria.app/latest/Angaria.dmg');
  });

  test('on a Mac the link downloads and no popup opens', () => {
    device(MAC, 0);
    expect(click(renderPage())).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('on a phone the link stays on the page and opens the popup', () => {
    device(IPHONE, 5);
    expect(click(renderPage())).toBe(false);
    expect(screen.getByRole('dialog', { name: "Angaria Mac'te çalışır" })).toBeInTheDocument();
  });

  test('on an iPad asking for the desktop site the popup opens too', () => {
    device(MAC, 5);
    expect(click(renderPage())).toBe(false);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('closing gives focus back to the button that opened it', () => {
    device(IPHONE, 5);
    const link = renderPage();
    click(link);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(link).toHaveFocus();
  });

  test('copies the tagged link and says so', async () => {
    device(IPHONE, 5);
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal(
      'navigator',
      Object.assign(Object.create(navigator), { clipboard: { writeText } }),
    );
    click(renderPage());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Bağlantıyı kopyala' }));
    });
    expect(writeText).toHaveBeenCalledWith(
      'https://angaria.app/?utm_source=share&utm_medium=phone_popup&utm_campaign=download',
    );
    expect(screen.getByRole('button', { name: 'Kopyalandı' })).toBeInTheDocument();
  });

  test('offers the share sheet only where the browser has one', () => {
    device(IPHONE, 5);
    click(renderPage());
    expect(screen.queryByRole('button', { name: 'Paylaş' })).not.toBeInTheDocument();
  });
});
