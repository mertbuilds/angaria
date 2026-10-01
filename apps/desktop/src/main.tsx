import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import { flushVaultOnClose } from './lib/app-vault.ts';
import { restoreTheme } from './lib/theme.ts';
import '@angaria/ui/fonts.css';
import '@angaria/ui/theme.css';
import '@angaria/ui/base.css';
import './app.css';

restoreTheme();
flushVaultOnClose();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
