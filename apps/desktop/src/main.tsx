import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import '@angaria/ui/fonts.css';
import '@angaria/ui/theme.css';
// After theme.css: the pre-relaunch screens keep their own values for the
// shared variable names (--popover, --sidebar, ...) until they are rebuilt.
import './app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
