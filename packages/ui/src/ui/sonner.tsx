'use client';

import type { CSSProperties } from 'react';
import { Toaster as Sonner } from 'sonner';
import type { ToasterProps } from 'sonner';

// Sonner injects its own unlayered CSS, which beats StyleX's layers, so the
// theme goes in through sonner's variables and inline styles. Its "system"
// theme follows prefers-color-scheme only; the colors come from theme.css
// variables, so a forced data-theme still paints the toasts right.
const toasterStyle = {
  '--border-radius': 'var(--radius)',
  '--normal-bg': 'var(--popover)',
  '--normal-border': 'var(--border)',
  '--normal-text': 'var(--popover-foreground)',
  fontFamily: 'var(--font-sans)',
} as CSSProperties;

const Toaster = ({ toastOptions, ...props }: ToasterProps) => (
  <Sonner
    data-slot="sonner"
    style={toasterStyle}
    theme="system"
    toastOptions={{
      ...toastOptions,
      // No shadows in this system.
      style: { boxShadow: 'none', ...toastOptions?.style },
    }}
    {...props}
  />
);

export { Toaster };
