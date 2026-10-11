import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  getDrafts,
  getInvoiceDetail,
  getInvoiceHTML,
  getUserInfo,
  login,
  logout,
} from './angaria.ts';
import { withQRCode } from './invoice-preview.ts';
import { newestFirst, type DateRange } from './invoices.ts';
import { createSessionQueue, type GIBAccount } from './session-queue.ts';
import { useStore } from './store.tsx';
import type { GIBIdentity, Invoice } from './types.ts';

type LoginListener = (username: string, identity: GIBIdentity | null) => void;

const loginListeners = new Set<LoginListener>();

/**
 * The app's one GİB session queue: run every GİB call through it. Each login
 * also reads the account's own taxpayer (Kullanıcı bilgileri) on the new
 * session; a failure there never fails the login.
 */
export const gib = createSessionQueue({
  login: async (username, password) => {
    const session = await login(username, password);
    const identity = await getUserInfo(session).catch(() => null);
    for (const listener of loginListeners) {
      listener(username, identity?.taxID ? identity : null);
    }
    return session;
  },
  logout,
});

/**
 * Calls `listener` with the user code and the account's own taxpayer (null
 * when GİB did not say) after each login GİB accepts. Returns the unsubscribe.
 */
export function onGIBLogin(listener: LoginListener) {
  loginListeners.add(listener);
  return () => {
    loginListeners.delete(listener);
  };
}

/**
 * The active company's GİB account. Its key also scopes the cached GİB data
 * (['invoices', key, ...]), so another user never shows stale rows.
 */
export function useGIBAccount(): GIBAccount {
  const { activeEntityId, creds, getCredentials } = useStore();
  return useMemo(
    () => ({
      credentials: () => getCredentials(activeEntityId),
      key: creds.username,
    }),
    [activeEntityId, creds.username, getCredentials],
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
 * GİB's HTML rendering of an invoice with its QR code drawn in and its scripts
 * dropped. Render it only in a sandboxed iframe without `allow-scripts`
 * (InvoiceFrame, InvoicePaper). Keyed by status: signing changes the page.
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
