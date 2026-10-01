import { useNavigate } from '@tanstack/react-router';
import { useCallback, type ReactNode } from 'react';

// Bridges for the pre-relaunch screens in src/pages, which keep their Tailwind
// look and their `onNavigate(page)` props until each one is ported to
// @angaria/ui. Delete this file with the last of them.

/** The old page ids that src/pages pass to `onNavigate`. */
export type Page =
  | 'create'
  | 'invoices'
  | 'invoice-templates'
  | 'item-templates'
  | 'customers'
  | 'settings';

/** `onNavigate` for the old pages, backed by the router. */
export function useLegacyNavigate() {
  const navigate = useNavigate();
  return useCallback(
    (page: Page) => {
      switch (page) {
        case 'create':
          void navigate({ to: '/yeni' });
          break;
        case 'invoices':
          void navigate({ to: '/faturalar' });
          break;
        case 'invoice-templates':
          void navigate({ search: {}, to: '/sablonlar' });
          break;
        case 'item-templates':
          void navigate({ search: { sekme: 'kalemler' }, to: '/sablonlar' });
          break;
        case 'customers':
          void navigate({ to: '/musteriler' });
          break;
        case 'settings':
          void navigate({ to: '/ayarlar' });
          break;
      }
    },
    [navigate],
  );
}

/** The old screens' centered column. */
export function LegacyPage({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-6 py-8">{children}</div>;
}
