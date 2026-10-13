import { capStyles, toast } from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { LoaderCircleIcon, XIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useRef } from 'react';
import { invoiceDetailQuery, useGIBAccount } from '@/lib/gib.ts';
import { isBlankForm, sameAsBlank } from '@/lib/invoice-form.ts';
import { blankForm, useStore } from '@/lib/store.tsx';
import { CreateInvoicePage } from '@/pages/create-invoice.tsx';
import { InvoiceStart } from '@/pages/invoice-start.tsx';
import { useClearInvoiceForm, useStoredInvoiceForm } from '@/pages/use-invoice-form.ts';
import { useRequireCredentials } from '@/shell/credentials-guard.tsx';
import { Screen } from '@/shell/screen.tsx';
import { useCustomerParam } from '@/shell/use-customer-param.ts';

interface NewInvoiceSearch {
  /** ETTN of a GİB invoice to copy into the form ("tekrar kes"). */
  kaynak?: string;
  /** Id of a saved customer to start an invoice for (useCustomerParam). */
  musteri?: string;
}

// The router JSON-parses search values, so an all-digit id arrives as a number.
const searchId = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) || undefined : undefined;

export const Route = createFileRoute('/yeni')({
  component: NewInvoiceRoute,
  validateSearch: (search: Record<string, unknown>): NewInvoiceSearch => ({
    kaynak: searchId(search.kaynak),
    musteri: searchId(search.musteri),
  }),
});

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

const styles = create({
  chip: {
    alignItems: 'center',
    backgroundColor: colors.subtle,
    borderRadius: radius.full,
    color: colors.muted,
    display: 'inline-flex',
    fontSize: font.sizeXs,
    gap: spacing.s1,
    height: '1.75rem',
    minWidth: 0,
    paddingInlineEnd: spacing.s1,
    paddingInlineStart: spacing.s3,
  },
  chipClear: {
    alignItems: 'center',
    backgroundColor: {
      ':hover': colors.border,
      default: 'transparent',
    },
    borderRadius: radius.full,
    borderWidth: 0,
    color: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    flexShrink: 0,
    height: '1.25rem',
    justifyContent: 'center',
    outline: {
      ':focus-visible': `1px solid ${colors.muted}`,
      default: 'none',
    },
    padding: 0,
    width: '1.25rem',
  },
  chipIcon: {
    height: '0.75rem',
    width: '0.75rem',
  },
  chipName: {
    color: colors.fg,
    maxWidth: '14rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  loading: {
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    fontSize: font.sizeSm,
    gap: spacing.s3,
    justifyContent: 'center',
    paddingBlock: spacing.s16,
  },
  spinner: {
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: spin,
    },
    animationTimingFunction: 'linear',
    height: '1.5rem',
    width: '1.5rem',
  },
});

/**
 * Applies ?kaynak= to the store's invoice form once, then drops it from the
 * URL. Without it, /yeni shows the form as the store has it.
 */
function useFormSource() {
  const { kaynak } = Route.useSearch();
  const navigate = Route.useNavigate();
  const requireCredentials = useRequireCredentials();
  const { hasCredentials, invoiceSource, loadFromGIBInvoice, restoreInvoiceDraft } = useStore();
  const account = useGIBAccount();
  const stored = useStoredInvoiceForm();
  // The ETTN applied last, so a repeated run (StrictMode) loads and toasts once.
  const applied = useRef<string | null>(null);
  // Toast options with an undo that puts back the form a load is about to
  // replace, or none when it holds nothing a blank form does not.
  const undoReplace = useEffectEvent(() => {
    const values = stored;
    const source = invoiceSource;
    return sameAsBlank(values, blankForm())
      ? undefined
      : { action: { label: 'Geri al', onClick: () => restoreInvoiceDraft(values, source) } };
  });

  // Shares the Faturalar screen's cache: an invoice opened there loads at once.
  const source = useQuery({
    ...invoiceDetailQuery(account, kaynak ?? ''),
    enabled: Boolean(kaynak) && hasCredentials,
    meta: { onError: true },
  });

  useEffect(() => {
    if (!kaynak) {
      applied.current = null;
      return;
    }
    if (applied.current === kaynak) {
      return;
    }
    if (!hasCredentials) {
      applied.current = kaynak;
      requireCredentials();
      void navigate({ replace: true, search: {} });
    } else if (source.data) {
      applied.current = kaynak;
      const undo = undoReplace();
      loadFromGIBInvoice(source.data);
      toast.success('Fatura bilgileri forma yüklendi', undo);
      void navigate({ replace: true, search: {} });
    } else if (source.isError) {
      applied.current = kaynak;
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

/** "Faturadan: GIB2026000000041 ×": what filled the form; × clears it. */
function SourceChip() {
  const { invoiceSource } = useStore();
  const clearForm = useClearInvoiceForm();
  if (!invoiceSource) {
    return null;
  }

  return (
    <span {...props(styles.chip)}>
      <span {...props(capStyles.text)}>Faturadan:</span>
      <span {...props(styles.chipName, capStyles.text)}>{invoiceSource.label}</span>
      <button
        aria-label="Formu temizle"
        onClick={clearForm}
        type="button"
        {...props(styles.chipClear)}
      >
        <XIcon {...props(styles.chipIcon)} />
      </button>
    </span>
  );
}

function NewInvoiceRoute() {
  const { hasCredentials, invoiceFormRevision, invoiceStarted } = useStore();
  const stored = useStoredInvoiceForm();
  const { loadingSource } = useFormSource();
  useCustomerParam();

  let content;
  if (loadingSource) {
    content = (
      <div {...props(styles.loading)}>
        <LoaderCircleIcon aria-hidden {...props(styles.spinner)} />
        <p>Fatura bilgileri GİB’den alınıyor…</p>
      </div>
    );
  } else if (!invoiceStarted && hasCredentials && isBlankForm(stored)) {
    // Recent invoices need GİB: without an account the blank form opens.
    content = <InvoiceStart />;
  } else {
    // A new revision means the store's form was replaced: start the form over.
    content = <CreateInvoicePage key={invoiceFormRevision} />;
  }

  return (
    <Screen title="Yeni fatura" toolbar={<SourceChip />}>
      {content}
    </Screen>
  );
}
