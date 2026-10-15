import { afterEach, describe, expect, test, vi } from 'vitest';
import { track } from './analytics.ts';
import {
  closeSendToMac,
  isMacDevice,
  onDownloadClick,
  openSendToMac,
  SEND_LINK,
  sendToMacState,
  subscribeSendToMac,
} from './send-to-mac.ts';

vi.mock('./analytics.ts', () => ({ track: vi.fn() }));

const MAC = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0',
];
/** Safari on an iPad asks for the desktop site, with the user agent of a Mac. */
const IPAD_DESKTOP = MAC[0] ?? '';
const NOT_A_MAC = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  '',
];

afterEach(() => {
  closeSendToMac();
  vi.restoreAllMocks();
  vi.mocked(track).mockClear();
});

describe('isMacDevice', () => {
  test('a Mac is a Mac, with no touch screen or with one touch', () => {
    for (const userAgent of MAC) {
      expect(isMacDevice(userAgent, 0), userAgent).toBe(true);
      expect(isMacDevice(userAgent, 1), userAgent).toBe(true);
    }
  });

  test('an iPad with the user agent of a Mac is not a Mac', () => {
    expect(isMacDevice(IPAD_DESKTOP, 5)).toBe(false);
    expect(isMacDevice(IPAD_DESKTOP, 2)).toBe(false);
  });

  test('a phone, a tablet, Windows, Linux and no user agent are not a Mac', () => {
    for (const userAgent of NOT_A_MAC) {
      expect(isMacDevice(userAgent, 0), userAgent).toBe(false);
      expect(isMacDevice(userAgent, 5), userAgent).toBe(false);
    }
  });
});

test('the link to send on is the home page, tagged as shared from the popup', () => {
  expect(SEND_LINK).toBe(
    'https://angaria.app/?utm_source=share&utm_medium=phone_popup&utm_campaign=download',
  );
});

test('the popup opens with its button, closes keeping it, and tells who listens each time', () => {
  let told = 0;
  const stop = subscribeSendToMac(() => told++);
  const button = document.createElement('a');
  expect(sendToMacState().open).toBe(false);
  openSendToMac(button);
  expect(sendToMacState()).toEqual({ open: true, opener: button });
  closeSendToMac();
  expect(sendToMacState()).toEqual({ open: false, opener: button });
  closeSendToMac();
  expect(told).toBe(2);
  stop();
  openSendToMac(button);
  closeSendToMac();
  expect(told).toBe(2);
});

/** Clicks a download link on a device that tells the browser these. */
function click(userAgent: string, maxTouchPoints: number) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: maxTouchPoints,
  });
  const link = document.createElement('a');
  const event = { currentTarget: link, preventDefault: vi.fn() };
  onDownloadClick(event, 'hero');
  return { event, link };
}

describe('onDownloadClick', () => {
  test('on a Mac the link downloads and counts a download', () => {
    const { event } = click(MAC[0] ?? '', 0);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('download_click', { location: 'hero' });
    expect(sendToMacState().open).toBe(false);
  });

  test('off a Mac the link stays on the page and opens the popup', () => {
    const { event, link } = click(IPAD_DESKTOP, 5);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('download_blocked_not_mac', { location: 'hero' });
    expect(sendToMacState()).toEqual({ open: true, opener: link });
  });
});
