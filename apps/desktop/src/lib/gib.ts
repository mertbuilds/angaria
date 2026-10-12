import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { isTauri } from '@tauri-apps/api/core';
import { useMemo } from 'react';
import {
  forceLogout,
  getDrafts,
  getInvoiceDetail,
  getInvoiceHTML,
  getTaxpayer,
  getUserInfo,
  login,
  logout,
} from './angaria.ts';
import { vault } from './app-vault.ts';
import { withQRCode } from './invoice-preview.ts';
import { loadInvoiceWeeks, localWeekStore } from './invoice-weeks.ts';
import type { DateRange } from './invoices.ts';
import { createSessionQueue, SESSION_LINGER_MS, type GIBAccount } from './session-queue.ts';
import { useStore } from './store.tsx';
import type { GIBIdentity, Invoice } from './types.ts';

type LoginListener = (username: string, identity: GIBIdentity | null) => void;

const loginListeners = new Set<LoginListener>();

/**
 * The app's one GİB session queue: run every GİB call through it. Each login
 * also reads the account's own taxpayer (Kullanıcı bilgileri) on the new
 * session; a failure there never fails the login. The session stays open
 * SESSION_LINGER_MS after the last call; `gib.close()` ends it sooner. The
 * open session is kept in the vault until its logout, so the next launch
 * logs out one this run could not (`gib.endLeftovers()`).
 */
export const gib = createSessionQueue(
  {
    forceLogout,
    login: async (username, password) => {
      const session = await login(username, password);
      const identity = await getUserInfo(session).catch(() => null);
      for (const listener of loginListeners) {
        listener(username, identity?.taxID ? identity : null);
      }
      return session;
    },
    logout,
  },
  {
    lingerMs: SESSION_LINGER_MS,
    // The vault is Tauri only.
    store: isTauri()
      ? {
          read: () => vault.getSessions(),
          write: (key, session) => vault.saveSession(key, session),
        }
      : undefined,
  },
);

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

/**
 * The name and tax office GİB's registry has for `taxID`, as the portal's own
 * form fills them: null when it has none. Asked once per number this session.
 */
export const taxpayerQuery = (account: GIBAccount, taxID: string) =>
  queryOptions({
    queryFn: ({ signal }) => gib.run(account, (session) => getTaxpayer(session, taxID), { signal }),
    queryKey: ['taxpayer', account.key, taxID],
    staleTime: Number.POSITIVE_INFINITY,
  });

/** Where invoiceListQuery reports how many of its weeks it has read. */
export const invoiceListProgressKey = (account: GIBAccount, range: DateRange) => [
  'invoices-progress',
  account.key,
  range.start,
  range.end,
];

/**
 * Every document dated within `range`, newest first. Long ranges fill in week
 * by week, newest first, and settled weeks come from this Mac
 * (`lib/invoice-weeks.ts`).
 */
export const invoiceListQuery = (account: GIBAccount, range: DateRange) =>
  queryOptions({
    queryFn: ({ client, queryKey, signal }) =>
      gib.run(
        account,
        (session, jobSignal) =>
          loadInvoiceWeeks({
            end: range.end,
            fetchWeek: (start, end) => getDrafts(session, start, end, { signal: jobSignal }),
            onPartial: (rows) => client.setQueryData(queryKey, rows),
            onProgress: (progress) =>
              client.setQueryData(invoiceListProgressKey(account, range), progress),
            start: range.start,
            store: localWeekStore(account.key),
          }),
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
