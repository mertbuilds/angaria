/** The three theme states, in the order a control renders them. */
export const themeChoices = ['system', 'light', 'dark'] as const;

export type ThemeChoice = (typeof themeChoices)[number];

/**
 * Puts the choice on `<html>` as `data-theme`. `system` removes the attribute,
 * so the `prefers-color-scheme` rules in theme.css decide. Persisting the
 * choice is up to the app.
 */
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement) {
  if (choice === 'system') {
    delete root.dataset['theme'];
  } else {
    root.dataset['theme'] = choice;
  }
}

/** The choice currently on `<html>`. */
export function readTheme(root: HTMLElement = document.documentElement): ThemeChoice {
  const value = root.dataset['theme'];
  return value === 'light' || value === 'dark' ? value : 'system';
}
