/** The color palettes in src/palettes.css, in the order the switch shows them. */
export const paletteChoices = ['mist', 'paper', 'tide'] as const;

export type PaletteChoice = (typeof paletteChoices)[number];

/** Code names, shown only by the development switch. */
export const paletteLabels: Record<PaletteChoice, string> = {
  mist: 'Mist',
  paper: 'Paper',
  tide: 'Tide',
};

/** The palette index.html puts on <html>. Production builds always use it. */
export const DEFAULT_PALETTE: PaletteChoice = 'mist';

const PALETTE_STORAGE_KEY = 'angaria-palette';

/** The palette on `<html>`. */
export function readPalette(root: HTMLElement = document.documentElement): PaletteChoice {
  return paletteChoices.find((choice) => choice === root.dataset['palette']) ?? DEFAULT_PALETTE;
}

/** Dev only: applies the palette and remembers it for the next launch. */
export function setPalette(choice: PaletteChoice, root: HTMLElement = document.documentElement) {
  root.dataset['palette'] = choice;
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, choice);
  } catch {
    // The choice still applies to this session.
  }
}

/** Dev only: re-applies the palette picked under Ayarlar or ⌘K. Production keeps index.html's. */
export function restorePalette(root: HTMLElement = document.documentElement) {
  if (!import.meta.env.DEV) {
    return;
  }
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
