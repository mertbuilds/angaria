import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import { flushVaultOnClose } from './lib/app-vault.ts';
import { restorePalette } from './lib/palette.ts';
import { restoreTheme } from './lib/theme.ts';
import '@angaria/ui/fonts.css';
import '@angaria/ui/theme.css';
import '@angaria/ui/base.css';
import './palettes.css';
import './app.css';

restoreTheme();
restorePalette();
flushVaultOnClose();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
