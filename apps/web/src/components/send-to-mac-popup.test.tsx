import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { closeSendToMac, SEND_LINK } from '../lib/send-to-mac.ts';
import { DownloadButton } from './cta.tsx';
import { SendToMacPopup } from './send-to-mac-popup.tsx';

vi.mock('../lib/analytics.ts', () => ({ track: vi.fn() }));

const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const TITLE = "Angaria Mac'te çalışır";

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
    link.focus();
    followed = fireEvent.click(link);
  });
  return followed;
}

/** Opens the popup from a phone and gives back the link that opened it. */
async function openFromPhone() {
  device(IPHONE, 5);
  const link = renderPage();
  click(link);
  await screen.findByRole('dialog', { name: TITLE });
  return link;
}

/** Waits for the popup to go and checks focus went back to its link. */
async function expectClosedTo(link: HTMLElement) {
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(link).toHaveFocus());
}

afterEach(() => {
  act(() => closeSendToMac());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

  test('on a phone the link stays on the page and opens the popup', async () => {
    device(IPHONE, 5);
    expect(click(renderPage())).toBe(false);
    expect(await screen.findByRole('dialog', { name: TITLE })).toBeInTheDocument();
  });

  test('on an iPad asking for the desktop site the popup opens too', async () => {
    device(MAC, 5);
    expect(click(renderPage())).toBe(false);
    expect(await screen.findByRole('dialog', { name: TITLE })).toBeInTheDocument();
  });

  test('the close button closes it and gives focus back to the link', async () => {
    const link = await openFromPhone();
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
    await expectClosedTo(link);
  });

  test('Escape closes it and gives focus back to the link', async () => {
    const link = await openFromPhone();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await expectClosedTo(link);
  });

  test('a press outside closes it and gives focus back to the link', async () => {
    const link = await openFromPhone();
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.mouseUp(document.body);
    fireEvent.click(document.body);
    await expectClosedTo(link);
  });

  test('copies the tagged link and says so', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal(
      'navigator',
      Object.assign(Object.create(navigator), { clipboard: { writeText } }),
    );
    await openFromPhone();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Bağlantıyı kopyala' }));
    });
    expect(writeText).toHaveBeenCalledWith(SEND_LINK);
    expect(screen.getByRole('button', { name: 'Kopyalandı' })).toBeInTheDocument();
  });

  test('shares the tagged link where the browser has a share sheet', async () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { share }));
    await openFromPhone();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Paylaş' }));
    });
    expect(share).toHaveBeenCalledWith({ title: 'Angaria', url: SEND_LINK });
  });

  test('offers no share where the browser has no share sheet', async () => {
    await openFromPhone();
    expect(screen.queryByRole('button', { name: 'Paylaş' })).not.toBeInTheDocument();
  });
});
