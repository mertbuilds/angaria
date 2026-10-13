// The site's theme choice, after attentionawareness's (apps/web/src/lib/theme.ts):
// system, light or dark, written to `<html data-theme>` and kept in the browser.

/** The three states of the theme control, in the order it renders them. */
export const themeChoices = ['system', 'light', 'dark'] as const;

export type ThemeChoice = (typeof themeChoices)[number];

/** What lands in `data-theme` on `<html>`. `null` means: no attribute at all. */
type ThemeAttribute = 'dark' | 'light' | null;

/** The page's ground in each theme, as `--background` in @angaria/ui/theme.css has it. */
export const THEME_GROUND = { dark: '#000000', light: '#ffffff' } as const;

/** The one `theme-color` meta a chosen theme owns. React never renders it. */
const GROUND_META = 'angaria-theme-color';

/** Where the choice is kept in the browser. `system` is kept as no entry at all. */
const THEME_KEY = 'angaria-theme';

/**
 * Puts a kept choice on the page before it paints, so a reader who chose a
 * theme never sees the other one first. It runs in the head and does by hand
 * what `applyTheme` does, the meta of its own included.
 */
export const THEME_SCRIPT =
  `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark'){` +
  "var d=document.documentElement;d.setAttribute('data-theme',t);d.setAttribute('data-theme-choice',t);" +
  `var g=t==='dark'?'${THEME_GROUND.dark}':'${THEME_GROUND.light}';` +
  `var m=document.createElement('meta');m.id='${GROUND_META}';m.name='theme-color';m.content=g;document.head.prepend(m)` +
  '}}catch(e){}';

/**
 * Tells the browser the ground of the theme in use. The head has two
 * `theme-color` metas, one per system theme, which React renders. A chosen
 * theme gets a meta of its own with no `media`, first in the head so the
 * browser takes it; back on the system's, that meta goes.
 */
function nameGround(attribute: ThemeAttribute): void {
  const own = document.getElementById(GROUND_META);
  if (attribute === null) {
    own?.remove();
    return;
  }
  const meta = own ?? document.createElement('meta');
  meta.id = GROUND_META;
  meta.setAttribute('name', 'theme-color');
  meta.setAttribute('content', THEME_GROUND[attribute]);
  if (own === null) {
    document.head.prepend(meta);
  }
}

/** The kept choice. A browser that keeps nothing, or refuses to say, is on the system's. */
function storedTheme(): ThemeChoice {
  try {
    const kept = window.localStorage.getItem(THEME_KEY);
    return kept === 'dark' || kept === 'light' ? kept : 'system';
  } catch {
    return 'system';
  }
}

/** Keeps the choice for the next visit. A browser that refuses still gets it for this one. */
function storeTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'system') {
      window.localStorage.removeItem(THEME_KEY);
    } else {
      window.localStorage.setItem(THEME_KEY, choice);
    }
  } catch {
    // Storage is off: the choice lasts until the page is left.
  }
}

const listeners = new Set<() => void>();

/** The choice this tab is on: the kept one, read the first time it is asked for. */
let current: ThemeChoice | undefined;

/** The chosen theme is an external store, so the first client render matches the server's. */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** What the server renders, and what the client hydrates against. */
export function serverTheme(): ThemeChoice {
  return 'system';
}

/** The choice this tab is on, which starts at the kept one. */
export function readTheme(): ThemeChoice {
  current ??= storedTheme();
  return current;
}

/** Puts the choice on `<html>`, where the head's script put the kept one. */
function showTheme(choice: ThemeChoice): void {
  current = choice;
  const attribute: ThemeAttribute = choice === 'system' ? null : choice;
  const root = document.documentElement;
  if (attribute === null) {
    delete root.dataset['theme'];
    delete root.dataset['themeChoice'];
  } else {
    root.dataset['theme'] = attribute;
    // The control draws its picked segment from this (`app.css`).
    root.dataset['themeChoice'] = attribute;
  }
  nameGround(attribute);
  for (const listener of listeners) {
    listener();
  }
}

/** Puts the choice on `<html>` and keeps it in the browser for every later visit. */
export function applyTheme(choice: ThemeChoice): void {
  storeTheme(choice);
  showTheme(choice);
}

// A choice made in another tab of the site is this tab's too. `key` is null
// when the whole storage was cleared.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_KEY || event.key === null) {
      showTheme(storedTheme());
    }
  });
}
