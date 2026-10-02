import { toast } from '@angaria/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store.tsx';

/**
 * Applies /yeni?musteri=<id> once (Müşteriler › Bu müşteriye fatura kes): a
 * blank invoice form with that saved customer as the recipient and its
 * defaults applied. Then drops the param from the URL.
 */
export function useCustomerParam() {
  const { musteri } = useSearch({ from: '/yeni' });
  const navigate = useNavigate({ from: '/yeni' });
  const { savedRecipients, startInvoiceFor } = useStore();
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (!musteri) {
      applied.current = null;
      return;
    }
    if (applied.current === musteri) {
      return;
    }
    applied.current = musteri;
    const customer = savedRecipients.find((recipient) => recipient.id === musteri);
    if (customer) {
      startInvoiceFor(customer);
    } else {
      toast.error('Müşteri bulunamadı. Silinmiş olabilir.');
    }
    void navigate({ replace: true, search: (prev) => ({ ...prev, musteri: undefined }) });
  }, [musteri, navigate, savedRecipients, startInvoiceFor]);
}
