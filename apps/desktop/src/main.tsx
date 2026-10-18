import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import { flushVaultOnClose } from './lib/app-vault.ts';
import { gib } from './lib/gib.ts';
import { connectMenuBar } from './lib/menu-bar.ts';
import { restorePalette } from './lib/palette.ts';
import { closeGIBSession, closeGIBSessionOnQuit } from './lib/quit.ts';
import { restoreTheme } from './lib/theme.ts';
import { router } from './router.tsx';
import '@angaria/ui/fonts.css';
import '@angaria/ui/theme.css';
import '@angaria/ui/base.css';
import './palettes.css';
import './app.css';

if (import.meta.env.DEV) {
  // Dev-only: devknobs emulates color scheme, motion, contrast, locale and
  // layout from inside the webview (⇧K toggles it), and grabs an element's
  // context for an agent (⇧G). import.meta.env.DEV is statically false in
  // production builds, so the chunk never ships.
  // oxlint-disable-next-line unicorn/prefer-top-level-await -- awaiting here would hold the app's first render on a dev panel
  void import('devknobs')
    .then(({ mount }) => mount())
    // oxlint-disable-next-line no-console -- the console is the only channel this dev-only failure has
    .catch((error: unknown) => console.warn('devknobs failed to load', error));
}

restoreTheme();
restorePalette();
flushVaultOnClose(closeGIBSession);
closeGIBSessionOnQuit();
// GİB sessions a crash or force quit left open would refuse this run's logins.
void gib.endLeftovers();
// The Kur günü setting is gone: the rate is always the previous business day's bulletin.
try {
  localStorage.removeItem('angaria-rate-day');
} catch {
  // No storage, nothing to clean.
}

// The MCP settings come from Rust first, so the server never starts on a stale copy.
await connectMenuBar((to) => void router.navigate({ to }));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
