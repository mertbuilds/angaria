import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getDrafts, getInvoiceDetail, getInvoiceHTML, login, logout } from './angaria.ts';
import { withQRCode } from './invoice-preview.ts';
import { newestFirst, type DateRange } from './invoices.ts';
import { createSessionQueue, type GIBAccount } from './session-queue.ts';
import { useStore } from './store.tsx';
import type { Invoice } from './types.ts';

/** The app's one GİB session queue: run every GİB call through it. */
export const gib = createSessionQueue({ login, logout });

/**
 * The active company's GİB account. Its key also scopes the cached GİB data
 * (['invoices', key, ...]), so another user or the test portal never shows
 * stale rows.
 */
export function useGIBAccount(): GIBAccount {
  const { activeEntityId, creds, getCredentials } = useStore();
  return useMemo(
    () => ({
      credentials: () => getCredentials(activeEntityId),
      key: `${creds.username}:${creds.testMode ? 'test' : 'canli'}`,
    }),
    [activeEntityId, creds.testMode, creds.username, getCredentials],
  );
}

/** Every document dated within `range`, newest first. */
export const invoiceListQuery = (account: GIBAccount, range: DateRange) =>
  queryOptions({
    queryFn: ({ signal }) =>
      gib.run(
        account,
        async (session, jobSignal) =>
          newestFirst(await getDrafts(session, range.start, range.end, { signal: jobSignal })),
        { signal },
      ),
    queryKey: ['invoices', account.key, range.start, range.end],
    staleTime: 60_000,
  });

/** Every list row of `account` cached this session, from all date ranges. */
export const cachedInvoices = (queryClient: QueryClient, account: GIBAccount) =>
  queryClient
    .getQueriesData<Array<Invoice>>({ queryKey: ['invoices', account.key] })
    .flatMap(([, invoices]) => invoices ?? []);

/**
 * GİB's invoice detail (recipient, items, totals). `background` for prefetches
 * such as the list's totals, which wait for everything the user asked for.
 */
export const invoiceDetailQuery = (account: GIBAccount, ettn: string, background = false) =>
  queryOptions({
    queryFn: ({ signal }) =>
      gib.run(account, (session) => getInvoiceDetail(session, ettn), { background, signal }),
    queryKey: ['invoice-detail', account.key, ettn],
    staleTime: Number.POSITIVE_INFINITY,
  });

/**
 * GİB's HTML rendering of an invoice with its QR code drawn in. Render it
 * only in `<iframe sandbox="">`. Keyed by status: signing changes the page.
 */
export const invoiceHTMLQuery = (account: GIBAccount, ettn: string, onayDurumu: string) =>
  queryOptions({
    queryFn: ({ signal }) =>
      gib.run(
        account,
        async (session) => withQRCode(await getInvoiceHTML(session, ettn, onayDurumu)),
        { signal },
      ),
    queryKey: ['invoice-html', account.key, ettn, onayDurumu],
    staleTime: Number.POSITIVE_INFINITY,
  });
