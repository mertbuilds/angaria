import { toast } from '@angaria/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { cachedInvoices, invoiceListQuery, useGIBAccount } from '@/lib/gib.ts';
import { lastMonthInvoice, previousMonthRange } from '@/lib/reissue.ts';
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
   * Loads last month's newest invoice into the form (/yeni?kaynak=). The
   * invoice lists already fetched this session are searched first, then last
   * month is fetched from GİB. Without one, the list opens to pick another.
   */
  const reissueLastMonth = useCallback(() => {
    const now = new Date();
    const reissue = (ettn: string) => void navigate({ search: { kaynak: ettn }, to: '/yeni' });
    const cached = lastMonthInvoice(cachedInvoices(queryClient, account), now);
    if (cached?.ettn) {
      reissue(cached.ettn);
      return;
    }
    if (!requireCredentials()) {
      return;
    }
    const range = previousMonthRange(now);
    const toastId = toast.loading('Geçen ayın faturaları GİB’den alınıyor...');
    void queryClient.fetchQuery(invoiceListQuery(account, range)).then(
      (invoices) => {
        const source = lastMonthInvoice(invoices, now);
        if (source?.ettn) {
          toast.dismiss(toastId);
          reissue(source.ettn);
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
