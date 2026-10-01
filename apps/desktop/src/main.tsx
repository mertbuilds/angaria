import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import { restoreTheme } from './lib/theme.ts';
import '@angaria/ui/fonts.css';
import '@angaria/ui/theme.css';
import '@angaria/ui/base.css';
import './app.css';

restoreTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
