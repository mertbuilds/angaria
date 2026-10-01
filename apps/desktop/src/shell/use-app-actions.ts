import { toast } from '@angaria/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { invoiceListQuery, useGIBAccount } from '@/lib/gib.ts';
import { fetchLastMonthInvoice } from '@/lib/reissue.ts';
import { useStore } from '@/lib/store.tsx';
import { useRequireCredentials } from './credentials-guard.tsx';
import type { SectionPath } from './nav.ts';

/** Commands shared by the sidebar, the ⌘K palette and the keyboard shortcuts. */
export function useAppActions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requireCredentials = useRequireCredentials();
  const account = useGIBAccount();
  const { resetInvoiceForm } = useStore();

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
   * Loads last month's newest invoice into the form (/yeni?kaynak=), from
   * GİB's list for that whole month (the cached one while fresh). Without
   * one, the list opens to pick another.
   */
  const reissueLastMonth = useCallback(() => {
    if (!requireCredentials()) {
      return;
    }
    const toastId = toast.loading('Geçen ayın faturaları GİB’den alınıyor...');
    void fetchLastMonthInvoice(
      (range) => queryClient.fetchQuery(invoiceListQuery(account, range)),
      new Date(),
    ).then(
      (source) => {
        if (source?.ettn) {
          toast.dismiss(toastId);
          void navigate({ search: { kaynak: source.ettn }, to: '/yeni' });
          return;
        }
        void navigate({ to: '/faturalar' });
        toast('Geçen ay kesilmiş fatura yok', {
          description: 'Tekrar kesmek istediğiniz faturayı listeden açıp Tekrar kes deyin.',
          id: toastId,
        });
      },
      (error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Bilinmeyen hata', { id: toastId });
      },
    );
  }, [account, navigate, queryClient, requireCredentials]);

  return { goTo, newInvoice, reissueLastMonth };
}
