import type { MouseEvent } from 'react';
import { track, type CtaLocation } from './analytics.ts';
import { SITE_URL } from './canonical.ts';

/**
 * True for a Mac, the only place the app runs, as the browser itself tells it.
 * Safari on an iPad has the user agent of a Mac, and a screen that takes more
 * than one touch, which no Mac has.
 */
export function isMacDevice(userAgent: string, maxTouchPoints: number): boolean {
  return userAgent.includes('Macintosh') && maxTouchPoints <= 1;
}

/** The link a visitor off a Mac copies or shares, to open on their Mac. Its tags tell these visits from the others. */
export const SEND_LINK = `${SITE_URL}/?utm_source=share&utm_medium=phone_popup&utm_campaign=download`;

/** The popup's state: whether it is open, and the download button that last opened it, kept after it closes so focus can go back to it. */
export interface SendToMac {
  open: boolean;
  opener: HTMLElement | null;
}

let state: SendToMac = { open: false, opener: null };
const listeners = new Set<() => void>();

function set(next: SendToMac) {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

/** Opens the page's one popup that says the app runs on a Mac. `button` is the download button that was pressed. */
export function openSendToMac(button: HTMLElement) {
  set({ open: true, opener: button });
}

export function closeSendToMac() {
  if (state.open) {
    set({ ...state, open: false });
  }
}

/** The popup's state, a snapshot for `useSyncExternalStore`. */
export function sendToMacState(): SendToMac {
  return state;
}

export function subscribeSendToMac(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * Every download link's click. On a Mac the link downloads the installer as
 * it is; anywhere else it stays on the page and opens the popup instead. The
 * link's href stays the installer, so a page without JavaScript still has it.
 */
export function onDownloadClick(
  event: Pick<MouseEvent<HTMLElement>, 'currentTarget' | 'preventDefault'>,
  location: CtaLocation,
) {
  if (isMacDevice(navigator.userAgent, navigator.maxTouchPoints)) {
    track('download_click', { location });
    return;
  }
  event.preventDefault();
  track('download_blocked_not_mac', { location });
  openSendToMac(event.currentTarget);
}
