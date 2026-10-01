import { toast } from '@angaria/ui';
import { colors, font, radius } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router';
import { XIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getInvoiceHTML, login, logout } from '@/lib/angaria.ts';
import { useStore } from '@/lib/store.tsx';
import type { Invoice } from '@/pages/invoices.tsx';
import { useRequireCredentials } from './credentials-guard.tsx';

/** Open invoice previews, oldest first. The HTML lives in the query cache. */
export interface PreviewTab {
  id: string;
  invoice: Invoice;
  label: string;
}

interface PreviewTabsValue {
  /** Drops every tab and its cached preview (entity switch). */
  clearTabs: () => void;
  /**
   * Closes a tab and drops its cached preview. When it is on screen, shows
   * the tab before it (or after it), or the list when none is left.
   */
  closeTab: (id: string) => void;
  /** Drops a tab and nothing else: no navigation, cache kept (failed loads). */
  dismissTab: (id: string) => void;
  /** Opens (or focuses) the invoice's tab and shows /faturalar/$ettn. */
  openPreview: (invoice: Invoice) => Promise<void>;
  tabs: ReadonlyArray<PreviewTab>;
}

const MAX_TABS = 5;

const PreviewTabsContext = createContext<PreviewTabsValue | null>(null);

/** Query key of an invoice's GİB HTML (useInvoicePreview). */
export const invoiceHtmlKey = (entityId: string, ettn: string) => ['invoice-html', entityId, ettn];

/** The invoice row for `ettn` from any cached invoice list, or null. */
export function findCachedInvoice(queryClient: QueryClient, ettn: string): Invoice | null {
  for (const [, invoices] of queryClient.getQueriesData<Array<Invoice>>({
    queryKey: ['invoices'],
  })) {
    const match = invoices?.find((invoice) => invoice.ettn === ettn);
    if (match) {
      return match;
    }
  }
  return null;
}

/**
 * GİB's HTML rendering of an invoice, fetched with a fresh session and kept
 * until its tab closes. Render it only in `<iframe sandbox="">`.
 */
export function useInvoicePreview(invoice: Invoice | null) {
  const { activeEntityId, getCredentials, hasCredentials } = useStore();
  const ettn = invoice?.ettn ?? '';
  const onayDurumu = invoice?.onayDurumu ?? '';
  return useQuery({
    enabled: ettn !== '' && hasCredentials,
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const { password, testMode, username } = await getCredentials(activeEntityId);
      const session = await login(username, password, testMode);
      try {
        return await getInvoiceHTML(session, ettn, onayDurumu);
      } finally {
        logout(session).catch(() => {});
      }
    },
    queryKey: invoiceHtmlKey(activeEntityId, ettn),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** The ETTN of the preview on screen, undefined anywhere but /faturalar/$ettn. */
function useShownPreviewId() {
  const matchRoute = useMatchRoute();
  const match = matchRoute({ to: '/faturalar/$ettn' });
  return match ? match.ettn : undefined;
}

export function usePreviewTabs() {
  const value = useContext(PreviewTabsContext);
  if (!value) {
    throw new Error('usePreviewTabs must be used within PreviewTabsProvider');
  }
  return value;
}

export function PreviewTabsProvider({ children }: { children: ReactNode }) {
  const { activeEntityId } = useStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requireCredentials = useRequireCredentials();
  const shownId = useShownPreviewId();
  const [tabs, setTabs] = useState<Array<PreviewTab>>([]);

  const forget = useCallback(
    (closed: ReadonlyArray<PreviewTab>) => {
      for (const tab of closed) {
        queryClient.removeQueries({ queryKey: invoiceHtmlKey(activeEntityId, tab.id) });
      }
    },
    [activeEntityId, queryClient],
  );

  const openPreview = useCallback(
    async (invoice: Invoice) => {
      const id = invoice.ettn;
      if (!id) {
        toast.error('Fatura ETTN bulunamadı');
        return;
      }
      if (!tabs.some((tab) => tab.id === id)) {
        if (!requireCredentials()) {
          return;
        }
        const label = invoice.belgeNumarasi || invoice.aliciUnvanAdSoyad || 'Fatura';
        const next = [...tabs, { id, invoice, label }];
        forget(next.slice(0, -MAX_TABS));
        setTabs(next.slice(-MAX_TABS));
      }
      await navigate({ params: { ettn: id }, to: '/faturalar/$ettn' });
    },
    [forget, navigate, requireCredentials, tabs],
  );

  const closeTab = useCallback(
    (id: string) => {
      const index = tabs.findIndex((tab) => tab.id === id);
      if (index === -1) {
        return;
      }
      forget([tabs[index]]);
      setTabs(tabs.filter((tab) => tab.id !== id));
      if (shownId === id) {
        const neighbor = tabs[index - 1] ?? tabs[index + 1];
        void navigate(
          neighbor
            ? { params: { ettn: neighbor.id }, to: '/faturalar/$ettn' }
            : { to: '/faturalar' },
        );
      }
    },
    [forget, navigate, shownId, tabs],
  );

  const dismissTab = useCallback((id: string) => {
    setTabs((current) => current.filter((tab) => tab.id !== id));
  }, []);

  const clearTabs = useCallback(() => {
    setTabs([]);
    queryClient.removeQueries({ queryKey: ['invoice-html'] });
  }, [queryClient]);

  const value = useMemo(
    () => ({ clearTabs, closeTab, dismissTab, openPreview, tabs }),
    [clearTabs, closeTab, dismissTab, openPreview, tabs],
  );

  return <PreviewTabsContext.Provider value={value}>{children}</PreviewTabsContext.Provider>;
}

const styles = create({
  close: {
    alignItems: 'center',
    backgroundColor: {
      ':hover': colors.border,
      default: 'transparent',
    },
    borderRadius: radius.full,
    borderWidth: 0,
    color: 'inherit',
    display: 'flex',
    flexShrink: 0,
    height: '1.25rem',
    justifyContent: 'center',
    padding: 0,
    width: '1.25rem',
  },
  closeIcon: {
    height: '0.75rem',
    width: '0.75rem',
  },
  label: {
    color: 'inherit',
    maxWidth: '9rem',
    overflow: 'hidden',
    textDecorationLine: 'none',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  strip: {
    alignItems: 'center',
    display: 'flex',
    gap: '0.25rem',
    minWidth: 0,
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  tab: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: radius.full,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    display: 'flex',
    flexShrink: 0,
    fontSize: font.sizeSm,
    gap: '0.25rem',
    height: '1.75rem',
    paddingInline: '0.75rem',
  },
  tabActive: {
    backgroundColor: colors.subtle,
    color: colors.fg,
  },
  tabClosable: {
    paddingInlineEnd: '0.25rem',
  },
});

/**
 * The open previews as toolbar tabs, after a "Liste" tab back to the invoice
 * list. Renders nothing while no preview is open.
 */
export function PreviewTabStrip() {
  const { closeTab, tabs } = usePreviewTabs();
  const shownId = useShownPreviewId();

  if (tabs.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Açık faturalar" {...props(styles.strip)}>
      <span {...props(styles.tab, shownId === undefined && styles.tabActive)}>
        <Link to="/faturalar" {...props(styles.label)}>
          Liste
        </Link>
      </span>
      {tabs.map((tab) => (
        <span
          key={tab.id}
          {...props(styles.tab, styles.tabClosable, shownId === tab.id && styles.tabActive)}
        >
          <Link params={{ ettn: tab.id }} to="/faturalar/$ettn" {...props(styles.label)}>
            {tab.label}
          </Link>
          <button
            aria-label={`${tab.label} sekmesini kapat`}
            onClick={() => closeTab(tab.id)}
            type="button"
            {...props(styles.close)}
          >
            <XIcon {...props(styles.closeIcon)} />
          </button>
        </span>
      ))}
    </nav>
  );
}
