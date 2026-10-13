import {
  Badge,
  Button,
  Kbd,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useNavigate, useParams } from '@tanstack/react-router';
import { FilePlusIcon, RefreshCwIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { UNNAMED_CUSTOMER } from '@/lib/copy.ts';
import { errorMessage, toastError } from '@/lib/gib-errors.ts';
import {
  invoiceDetailQuery,
  invoiceListProgressKey,
  invoiceListQuery,
  useGIBAccount,
} from '@/lib/gib.ts';
import { localWeekStore, type WeekProgress } from '@/lib/invoice-weeks.ts';
import {
  invoiceStatus,
  matchesStatus,
  parseGIBInvoice,
  STATUS_FILTERS,
  type StatusFilter,
} from '@/lib/invoices.ts';
import { useStore } from '@/lib/store.tsx';
import type { Invoice } from '@/lib/types.ts';
import { formatDateHuman } from '@/lib/utils.ts';
import { ErrorState } from '@/shell/error-state.tsx';
import { ListDetail } from '@/shell/list-detail.tsx';
import { Screen } from '@/shell/screen.tsx';
import {
  EmptyState,
  formatMoney,
  matchesQuery,
  SearchableList,
  useListSelection,
} from '@/shell/searchable-list.tsx';
import { useAppActions } from '@/shell/use-app-actions.ts';
import { DateRangeMenu } from './invoice-date-range.tsx';

const isMac = navigator.userAgent.includes('Mac');

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

const styles = create({
  // Above the list while GİB sends it week by week, or when it stopped part way.
  banner: {
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: 'solid',
    borderBlockEndWidth: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    paddingBlock: spacing.s3,
    paddingInline: spacing.s4,
  },
  bannerRow: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s3,
    justifyContent: 'space-between',
  },
  bannerText: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
  },
  pane: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  },
  paneBody: {
    flexGrow: 1,
    minHeight: 0,
  },
  // Menu and tooltip triggers carry their own data-slot, so the theme's
  // button icon size does not reach their icons.
  icon: {
    flexShrink: 0,
    height: '1rem',
    width: '1rem',
  },
  skeleton: {
    backgroundColor: colors.subtle,
    borderRadius: radius.full,
    display: 'block',
    height: '0.75rem',
  },
  skeletonList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    padding: spacing.s4,
  },
  skeletonRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  skeletonWidth: (width: string) => ({
    width,
  }),
  spinning: {
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: spin,
    },
    animationTimingFunction: 'linear',
  },
  status: {
    width: '9rem',
  },
  total: {
    display: 'inline-flex',
    justifyContent: 'flex-end',
    minWidth: '4rem',
  },
});

/** True once the element has been on screen, so off-screen rows fetch nothing. */
function useSeen(ref: RefObject<Element | null>) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (seen || !element) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setSeen(true);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, seen]);
  return seen;
}

const selectTotal = (detail: Record<string, unknown>) => {
  const { settings, total } = parseGIBInvoice(detail);
  return formatMoney(total, settings.currency);
};

/**
 * The row's amount. GİB's list has none, so each visible row reads the
 * invoice detail in the background (one shared session, after anything the
 * user asked for). Deleted drafts show none.
 */
export function InvoiceTotal({ invoice }: { invoice: Invoice }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useSeen(ref);
  const account = useGIBAccount();
  const ettn = invoice.ettn ?? '';
  const deleted = invoice.onayDurumu === 'Silinmiş';
  const total = useQuery({
    ...invoiceDetailQuery(account, ettn, true),
    enabled: seen && !deleted && ettn !== '',
    select: selectTotal,
  });

  if (deleted || total.isError) {
    return null;
  }
  return (
    <span ref={ref} {...props(styles.total)}>
      {total.data ?? (
        <span
          aria-label="Tutar yükleniyor"
          {...props(styles.skeleton, styles.skeletonWidth('4rem'))}
        />
      )}
    </span>
  );
}

function ListSkeleton() {
  return (
    <div aria-label="Faturalar yükleniyor" role="status" {...props(styles.skeletonList)}>
      {['70%', '55%', '80%', '60%', '75%'].map((width) => (
        <div key={width} {...props(styles.skeletonRow)}>
          <span {...props(styles.skeleton, styles.skeletonWidth(width))} />
          <span {...props(styles.skeleton, styles.skeletonWidth('45%'))} />
        </div>
      ))}
    </div>
  );
}

function StatusSelect({
  onChange,
  value,
}: {
  onChange: (value: StatusFilter) => void;
  value: StatusFilter;
}) {
  return (
    <Select items={STATUS_FILTERS} onValueChange={(next) => next && onChange(next)} value={value}>
      <SelectTrigger aria-label="Durum" size="sm" style={styles.status}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_FILTERS.map((filter) => (
          <SelectItem key={filter.value} value={filter.value}>
            {filter.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const matchesRow = ({ invoice }: { invoice: Invoice }, query: string) =>
  matchesQuery(
    query,
    invoice.aliciUnvanAdSoyad ?? '',
    invoice.belgeNumarasi ?? '',
    invoice.aliciVknTckn ?? '',
  );

/**
 * Faturalar: GİB's documents in the chosen range on the left, the open one
 * (child route /faturalar/$ettn) on the right. ↑/↓ move, ↵ or a click opens,
 * ⌘R refreshes.
 */
export function InvoicesScreen() {
  const navigate = useNavigate();
  const { newInvoice } = useAppActions();
  const { hasCredentials, invoiceDateRange, setInvoiceDateRange } = useStore();
  const account = useGIBAccount();
  const { ettn: openEttn } = useParams({ strict: false });
  const [status, setStatus] = useState<StatusFilter>('tumu');
  const [query, setQuery] = useState('');
  const list = useQuery({
    ...invoiceListQuery(account, invoiceDateRange),
    enabled: hasCredentials,
  });

  const rows = useMemo(
    () =>
      (list.data ?? []).flatMap((invoice) =>
        invoice.ettn && matchesStatus(invoice, status) ? [{ id: invoice.ettn, invoice }] : [],
      ),
    [list.data, status],
  );
  const { select, selected, visible } = useListSelection(rows, query, matchesRow);

  useEffect(() => {
    if (openEttn) {
      select(openEttn);
    }
  }, [openEttn, select]);

  const { isFetching, refetch } = list;
  const refresh = useCallback(() => {
    if (!hasCredentials || isFetching) {
      return;
    }
    // ⌘R asks GİB for every week again, the kept ones too.
    localWeekStore(account.key).clear();
    void refetch().then((result) => {
      // Without data the list shows the error itself.
      if (result.error && result.data) {
        toastError(result.error, {
          openSettings: () => void navigate({ to: '/ayarlar' }),
          retry: () => void refetch(),
        });
      }
    });
  }, [account.key, hasCredentials, isFetching, navigate, refetch]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = isMac ? event.metaKey : event.ctrlKey;
      if (
        mod &&
        !event.altKey &&
        !event.shiftKey &&
        !event.defaultPrevented &&
        event.key.toLowerCase() === 'r'
      ) {
        event.preventDefault();
        refresh();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [refresh]);

  // How many of the range's weeks GİB has sent (lib/invoice-weeks.ts).
  const progress = useQuery<WeekProgress>({
    enabled: false,
    queryFn: () => ({ done: 0, total: 0 }),
    queryKey: invoiceListProgressKey(account, invoiceDateRange),
    staleTime: Number.POSITIVE_INFINITY,
  }).data;
  const loadingWeeks =
    list.isFetching &&
    progress !== undefined &&
    progress.total > 1 &&
    progress.done < progress.total;
  // A week failed after others came: the list shows what came, and says so.
  const incomplete = list.isError && list.data !== undefined && !list.isFetching;

  let listPane;
  if (list.data === undefined && list.isError) {
    listPane = <ErrorState error={list.error} onRetry={refresh} title="Faturalar alınamadı" />;
  } else if (list.data === undefined || (list.data.length === 0 && list.isFetching)) {
    listPane = <ListSkeleton />;
  } else if (list.data.length === 0) {
    listPane = (
      <EmptyState
        action={
          <Button onClick={newInvoice} variant="outline">
            <FilePlusIcon />
            Yeni fatura
          </Button>
        }
        title="Bu aralıkta fatura yok"
      >
        Başka bir tarih aralığı seç ya da yeni bir fatura kes.
      </EmptyState>
    );
  } else {
    listPane = (
      <SearchableList
        label="Faturalar"
        onOpen={(row) => void navigate({ params: { ettn: row.id }, to: '/faturalar/$ettn' })}
        onQueryChange={setQuery}
        onSelect={select}
        openHint="aç"
        openOnClick
        query={query}
        row={({ invoice }) => {
          const { hint, label, variant } = invoiceStatus(invoice);
          return {
            aside: <Badge variant={variant}>{label}</Badge>,
            subtitle: [invoice.belgeNumarasi, formatDateHuman(invoice.belgeTarihi ?? ''), hint]
              .filter(Boolean)
              .join(' · '),
            title: invoice.aliciUnvanAdSoyad || UNNAMED_CUSTOMER,
            trailing: <InvoiceTotal invoice={invoice} />,
          };
        }}
        searchPlaceholder="Müşteri, fatura no ya da VKN ara"
        selected={selected}
        visible={visible}
      />
    );
  }

  return (
    <Screen
      actions={
        <>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Yenile"
                  disabled={!hasCredentials || list.isFetching}
                  onClick={refresh}
                  size="icon"
                  variant="ghost"
                />
              }
            >
              <RefreshCwIcon {...props(styles.icon, list.isFetching && styles.spinning)} />
            </TooltipTrigger>
            <TooltipContent>
              Yenile <Kbd>{isMac ? '⌘R' : 'Ctrl R'}</Kbd>
            </TooltipContent>
          </Tooltip>
          <Button onClick={newInvoice}>
            <FilePlusIcon />
            Yeni fatura
          </Button>
        </>
      }
      scroll={false}
      title="Faturalar"
      toolbar={
        <>
          <DateRangeMenu onChange={setInvoiceDateRange} value={invoiceDateRange} />
          <StatusSelect onChange={setStatus} value={status} />
        </>
      }
    >
      {hasCredentials ? (
        <ListDetail
          defaultListWidth={360}
          detail={<Outlet />}
          list={
            loadingWeeks || incomplete ? (
              <div {...props(styles.pane)}>
                <div {...props(styles.banner)}>
                  {loadingWeeks && progress ? (
                    <>
                      <Progress
                        label="Faturalar GİB’den alınıyor"
                        max={progress.total}
                        value={progress.done}
                        valueText={`${progress.done}/${progress.total} hafta`}
                      />
                      <p {...props(styles.bannerText)}>
                        GİB faturaları haftalık veriyor, bu yüzden uzun bir aralık biraz sürer.
                        Liste geldikçe doluyor; geçmiş haftalar bu Mac’te saklanır, bir dahaki
                        sefere hemen açılır.
                      </p>
                    </>
                  ) : (
                    <div {...props(styles.bannerRow)}>
                      <p {...props(styles.bannerText)}>
                        Liste eksik: GİB bazı haftaları vermedi. {errorMessage(list.error)}
                      </p>
                      <Button onClick={() => void refetch()} variant="outline">
                        Tekrar dene
                      </Button>
                    </div>
                  )}
                </div>
                <div {...props(styles.paneBody)}>{listPane}</div>
              </div>
            ) : (
              listPane
            )
          }
          storageKey="faturalar-list-width"
        />
      ) : (
        <EmptyState
          action={<Button render={<Link to="/ayarlar" />}>Ayarlar’a git</Button>}
          title="GİB hesabı bağlı değil"
        >
          Faturalarını görmek için Ayarlar’da e-Arşiv portalı kullanıcı kodunu ve şifreni gir.
        </EmptyState>
      )}
    </Screen>
  );
}
