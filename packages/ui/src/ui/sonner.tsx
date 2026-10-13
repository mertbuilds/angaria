'use client';

import { XIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Toaster as Sonner } from 'sonner';
import type { ToasterProps } from 'sonner';

// Sonner injects its own unlayered CSS, which beats StyleX's layers, so the
// theme goes in through sonner's variables, inline styles and the unlayered
// toast rules in base.css (buttons, close button, two-action layout). Its
// "system" theme follows prefers-color-scheme only; the colors come from
// theme.css variables, so a forced data-theme still paints the toasts right.
//
// A toast takes up to two actions: `action` (the main one, filled) and
// `cancel` (a second action, outlined), and `closeButton` for a close button.
// Both buttons dismiss the toast after their onClick. The region is announced
// politely; ⌥T moves the focus into it.
const toasterStyle = {
  '--border-radius': 'var(--radius)',
  '--normal-bg': 'var(--popover)',
  '--normal-border': 'var(--border)',
  '--normal-text': 'var(--popover-foreground)',
  fontFamily: 'var(--font-sans)',
} as CSSProperties;

const Toaster = ({ toastOptions, ...props }: ToasterProps) => (
  <Sonner
    containerAriaLabel="Bildirimler"
    data-slot="sonner"
    icons={{ close: <XIcon size={14} /> }}
    style={toasterStyle}
    theme="system"
    toastOptions={{
      closeButtonAriaLabel: 'Kapat',
      ...toastOptions,
      // No shadows in this system.
      style: { boxShadow: 'none', ...toastOptions?.style },
    }}
    {...props}
  />
);

export { Toaster };
