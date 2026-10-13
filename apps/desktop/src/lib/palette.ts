import { useSyncExternalStore } from 'react';

/** The color palettes in src/palettes.css, in the order Ayarlar shows them. */
export const paletteChoices = ['mist', 'paper'] as const;

export type PaletteChoice = (typeof paletteChoices)[number];

export const paletteLabels: Record<PaletteChoice, string> = {
  mist: 'Serin',
  paper: 'Sıcak',
};

/** The palette index.html puts on <html>, until one is picked. */
export const DEFAULT_PALETTE: PaletteChoice = 'mist';

const PALETTE_STORAGE_KEY = 'angaria-palette';

/** The palette on `<html>`. */
function readPalette(root: HTMLElement = document.documentElement): PaletteChoice {
  return paletteChoices.find((choice) => choice === root.dataset['palette']) ?? DEFAULT_PALETTE;
}

/** Applies the palette and remembers it for the next launch. */
export function setPalette(choice: PaletteChoice, root: HTMLElement = document.documentElement) {
  root.dataset['palette'] = choice;
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, choice);
  } catch {
    // The choice still applies to this session.
  }
}

/** Re-applies the picked palette at startup. Without one, index.html's default stays. */
export function restorePalette(root: HTMLElement = document.documentElement) {
  try {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
    const choice = paletteChoices.find((item) => item === stored);
    if (choice) {
      root.dataset['palette'] = choice;
    }
  } catch {
    // No storage: index.html's default stays.
  }
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ['data-palette'] });
  return () => observer.disconnect();
}

/** The current palette, kept in step when Ayarlar or ⌘K switch it. */
export function usePalette(): PaletteChoice {
  return useSyncExternalStore(subscribe, readPalette);
}
