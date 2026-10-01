import { toast } from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { invoiceDetailQuery, useGIBAccount } from '@/lib/gib.ts';
import { useStore } from '@/lib/store.tsx';
import { CreateInvoicePage } from '@/pages/create-invoice.tsx';
import { useRequireCredentials } from '@/shell/credentials-guard.tsx';
import { LegacyPage } from '@/shell/legacy-page.tsx';
import { Screen } from '@/shell/screen.tsx';
import { useCustomerParam } from '@/shell/use-customer-param.ts';

interface NewInvoiceSearch {
  /** ETTN of a GİB invoice to copy into the form ("tekrar kes"). */
  kaynak?: string;
  /** Id of a saved customer to start a blank invoice for (useCustomerParam). */
  musteri?: string;
  /** Id of a saved invoice template to load into the form. */
  sablon?: string;
}

// The router JSON-parses search values, so an all-digit id arrives as a number.
const searchId = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) || undefined : undefined;

export const Route = createFileRoute('/yeni')({
  component: NewInvoiceRoute,
  validateSearch: (search: Record<string, unknown>): NewInvoiceSearch => ({
    kaynak: searchId(search.kaynak),
    musteri: searchId(search.musteri),
    sablon: searchId(search.sablon),
  }),
});

const styles = create({
  loading: {
    color: colors.muted,
    fontSize: font.sizeSm,
    paddingBlock: spacing.s16,
    textAlign: 'center',
  },
});

/**
 * Applies ?sablon= and ?kaynak= to the store's invoice form once, then drops
 * them from the URL. Without either, /yeni shows the form as the store has it.
 */
function useFormSource() {
  const { kaynak, sablon } = Route.useSearch();
  const navigate = Route.useNavigate();
  const requireCredentials = useRequireCredentials();
  const { hasCredentials, loadFromGIBInvoice, loadTemplate } = useStore();
  const account = useGIBAccount();
  const appliedTemplate = useRef<string | null>(null);

  // Shares the Faturalar screen's cache: an invoice opened there loads at once.
  const source = useQuery({
    ...invoiceDetailQuery(account, kaynak ?? ''),
    enabled: Boolean(kaynak) && hasCredentials,
    meta: { onError: true },
  });

  useEffect(() => {
    if (!sablon) {
      appliedTemplate.current = null;
      return;
    }
    if (appliedTemplate.current === sablon) {
      return;
    }
    appliedTemplate.current = sablon;
    const name = loadTemplate(sablon);
    if (name) {
      toast.success(`"${name}" şablonu yüklendi`);
    } else {
      toast.error('Şablon bulunamadı');
    }
    void navigate({ replace: true, search: {} });
  }, [loadTemplate, navigate, sablon]);

  useEffect(() => {
    if (!kaynak) {
      return;
    }
    if (!hasCredentials) {
      requireCredentials();
      void navigate({ replace: true, search: {} });
    } else if (source.data) {
      loadFromGIBInvoice(source.data);
      toast.success('Fatura bilgileri forma yüklendi');
      void navigate({ replace: true, search: {} });
    } else if (source.isError) {
      void navigate({ replace: true, search: {} });
    }
  }, [
    hasCredentials,
    kaynak,
    loadFromGIBInvoice,
    navigate,
    requireCredentials,
    source.data,
    source.isError,
  ]);

  return { loadingSource: Boolean(kaynak) && hasCredentials };
}

function NewInvoiceRoute() {
  const requireCredentials = useRequireCredentials();
  const { templateEditMode } = useStore();
  const { loadingSource } = useFormSource();
  useCustomerParam();

  return (
    <Screen title={templateEditMode ? 'Şablon düzenle' : 'Yeni fatura'}>
      <LegacyPage>
        {loadingSource ? (
          <p {...props(styles.loading)}>Fatura bilgileri GİB’den alınıyor...</p>
        ) : (
          <CreateInvoicePage requireCredentials={requireCredentials} />
        )}
      </LegacyPage>
    </Screen>
  );
}
