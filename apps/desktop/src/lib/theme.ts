import { applyTheme, themeChoices, type ThemeChoice } from '@angaria/ui/theme';

const THEME_STORAGE_KEY = 'angaria-theme';

/** The theme picked under Ayarlar, or null when none was picked yet. */
function storedTheme(): ThemeChoice | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return themeChoices.find((choice) => choice === value) ?? null;
  } catch {
    return null;
  }
}

/** Applies the choice and remembers it for the next launch. */
export function setTheme(choice: ThemeChoice) {
  applyTheme(choice);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // The choice still applies to this session.
  }
}

/** Re-applies the picked theme at startup. Without one, index.html's default stays. */
export function restoreTheme() {
  const choice = storedTheme();
  if (choice) {
    applyTheme(choice);
  }
}
