import { toast } from '@angaria/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { lastMonthInvoice, previousMonthRange } from '@/lib/reissue.ts';
import { useStore } from '@/lib/store.tsx';
import type { Invoice } from '@/pages/invoices.tsx';
import { useRequireCredentials } from './credentials-guard.tsx';
import type { SectionPath } from './nav.ts';

/** Commands shared by the sidebar, the ⌘K palette and the keyboard shortcuts. */
export function useAppActions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requireCredentials = useRequireCredentials();
  const { creds, resetInvoiceForm, setInvoiceDateRange } = useStore();

  /** A blank invoice form, like the sidebar's Yeni fatura. */
  const newInvoice = useCallback(() => {
    resetInvoiceForm();
    void navigate({ to: '/yeni' });
  }, [navigate, resetInvoiceForm]);

  const goTo = useCallback(
    (to: SectionPath) => {
      if (to === '/yeni') {
        newInvoice();
      } else {
        void navigate({ to });
      }
    },
    [navigate, newInvoice],
  );

  /**
   * Loads last month's newest invoice into the form (/yeni?kaynak=). The
   * invoice lists already fetched this session are searched first; when none
   * covers last month, the list opens on last month so the user can pick one.
   */
  const reissueLastMonth = useCallback(() => {
    const cached = queryClient
      .getQueriesData<Array<Invoice>>({ queryKey: ['invoices', creds.username, creds.testMode] })
      .flatMap(([, invoices]) => invoices ?? []);
    const now = new Date();
    const source = lastMonthInvoice(cached, now);
    if (source?.ettn) {
      void navigate({ search: { kaynak: source.ettn }, to: '/yeni' });
      return;
    }
    if (!requireCredentials()) {
      return;
    }
    setInvoiceDateRange(previousMonthRange(now));
    void navigate({ to: '/faturalar' });
    toast('Geçen ayın faturaları listeleniyor', {
      description: 'Tekrar kesmek istediğiniz faturanın menüsünden Şablon olarak kullan seçin.',
    });
  }, [
    creds.testMode,
    creds.username,
    navigate,
    queryClient,
    requireCredentials,
    setInvoiceDateRange,
  ]);

  return { goTo, newInvoice, reissueLastMonth };
}
