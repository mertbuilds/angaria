import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ChevronDownIcon, LoaderCircleIcon, RepeatIcon, XIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useRef } from 'react';
import { customerName } from '@/lib/customer.ts';
import { invoiceDetailQuery, useGIBAccount } from '@/lib/gib.ts';
import { isBlankForm } from '@/lib/invoice-form.ts';
import { useStore } from '@/lib/store.tsx';
import { CreateInvoicePage } from '@/pages/create-invoice.tsx';
import { useClearInvoiceForm, useStoredInvoiceForm } from '@/pages/use-invoice-form.ts';
import { useRequireCredentials } from '@/shell/credentials-guard.tsx';
import { Screen } from '@/shell/screen.tsx';
import { useAppActions } from '@/shell/use-app-actions.ts';
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
  menu: {
    maxWidth: '20rem',
    minWidth: '16rem',
  },
  menuHint: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: font.sizeXs,
    marginInlineStart: 'auto',
    maxWidth: '8rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  menuName: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
 * Applies ?sablon= and ?kaynak= to the store's invoice form once, then drops
 * them from the URL. Without either, /yeni shows the form as the store has it.
 */
function useFormSource() {
  const { kaynak, sablon } = Route.useSearch();
  const navigate = Route.useNavigate();
  const requireCredentials = useRequireCredentials();
  const { hasCredentials, invoiceSource, loadFromGIBInvoice, loadTemplate, restoreInvoiceDraft } =
    useStore();
  const account = useGIBAccount();
  const stored = useStoredInvoiceForm();
  // Toast options with an undo that puts back the form a load is about to
  // replace, or none when it is blank.
  const undoReplace = useEffectEvent(() => {
    const values = stored;
    const source = invoiceSource;
    return isBlankForm(values)
      ? undefined
      : { action: { label: 'Geri al', onClick: () => restoreInvoiceDraft(values, source) } };
  });
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
    const undo = undoReplace();
    const name = loadTemplate(sablon);
    if (name) {
      toast.success(`"${name}" şablonu yüklendi`, undo);
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
      const undo = undoReplace();
      loadFromGIBInvoice(source.data);
      toast.success('Fatura bilgileri forma yüklendi', undo);
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

/** "Şablondan: Aylık danışmanlık ×": what filled the form; × clears it. */
function SourceChip() {
  const { invoiceSource } = useStore();
  const clearForm = useClearInvoiceForm();
  if (!invoiceSource) {
    return null;
  }
  const [kind, name] =
    invoiceSource.kind === 'template'
      ? ['Şablondan', invoiceSource.name]
      : ['Faturadan', invoiceSource.label];

  return (
    <span {...props(styles.chip)}>
      {kind}:<span {...props(styles.chipName)}>{name}</span>
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

const RECENT_TEMPLATES = 8;

/** Fills the form from a template or from last month's invoice. */
function FillMenu() {
  const { invoiceTemplates } = useStore();
  const { reissueLastMonth } = useAppActions();
  const navigate = Route.useNavigate();
  const recent = invoiceTemplates
    .toSorted((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
    .slice(0, RECENT_TEMPLATES);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        Şablondan
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={styles.menu}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Şablonlar</DropdownMenuLabel>
          {recent.length === 0 && <DropdownMenuItem disabled>Henüz şablon yok</DropdownMenuItem>}
          {recent.map((template) => (
            <DropdownMenuItem
              key={template.id}
              onClick={() => void navigate({ search: { sablon: template.id } })}
            >
              <span {...props(styles.menuName)}>{template.name}</span>
              <span {...props(styles.menuHint)}>{customerName(template.recipient)}</span>
            </DropdownMenuItem>
          ))}
          {invoiceTemplates.length > 0 && (
            <DropdownMenuItem onClick={() => void navigate({ search: {}, to: '/sablonlar' })}>
              Tüm şablonlar
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={reissueLastMonth}>
          <RepeatIcon />
          Geçen ayın faturasını tekrar kes
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NewInvoiceRoute() {
  const { invoiceFormRevision } = useStore();
  const { loadingSource } = useFormSource();
  useCustomerParam();

  return (
    <Screen actions={<FillMenu />} title="Yeni fatura" toolbar={<SourceChip />}>
      {loadingSource ? (
        <div {...props(styles.loading)}>
          <LoaderCircleIcon aria-hidden {...props(styles.spinner)} />
          <p>Fatura bilgileri GİB’den alınıyor</p>
        </div>
      ) : (
        // A new revision means the store's form was replaced: start the form over.
        <CreateInvoicePage key={invoiceFormRevision} />
      )}
    </Screen>
  );
}
