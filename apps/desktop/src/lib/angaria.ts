import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { createClient } from 'angaria-earsiv-sdk';
import { fetchTCMBRateTable as _fetchTCMBRateTable } from 'angaria-utils';

export type { SessionInfo, InvoiceItem, InvoiceDetails } from 'angaria-earsiv-sdk';
export type { TCMBRateTable } from 'angaria-utils';

// Dev only: VITE_GIB_FIXTURES=1 answers GİB calls from src/dev/gib-fixtures.ts,
// for the screens in a plain browser. import.meta.env.DEV is statically false
// in production builds, so the fixtures never ship.
const gibFetch: typeof tauriFetch =
  import.meta.env.DEV && import.meta.env.VITE_GIB_FIXTURES === '1'
    ? (input, init) =>
        import('../dev/gib-fixtures.ts').then(({ fixtureFetch }) => fixtureFetch(input, init))
    : tauriFetch;

const client = createClient({ fetch: gibFetch });

export const login = (...args: Parameters<typeof client.login>) => client.login(...args);
export const logout = (...args: Parameters<typeof client.logout>) => client.logout(...args);
export const forceLogout = (...args: Parameters<typeof client.forceLogout>) =>
  client.forceLogout(...args);
export const getUUID = (...args: Parameters<typeof client.getUUID>) => client.getUUID(...args);
export const createDraftInvoice = (...args: Parameters<typeof client.createDraftInvoice>) =>
  client.createDraftInvoice(...args);
export const getInvoiceDetail = (...args: Parameters<typeof client.getInvoiceDetail>) =>
  client.getInvoiceDetail(...args);
export const getInvoiceHTML = (...args: Parameters<typeof client.getInvoiceHTML>) =>
  client.getInvoiceHTML(...args);
export const getDrafts = (...args: Parameters<typeof client.getDrafts>) =>
  client.getDrafts(...args);
export const signInvoiceHSM = (...args: Parameters<typeof client.signInvoiceHSM>) =>
  client.signInvoiceHSM(...args);
export const getSigningPhone = (...args: Parameters<typeof client.getSigningPhone>) =>
  client.getSigningPhone(...args);
export const requestSigningSMS = (...args: Parameters<typeof client.requestSigningSMS>) =>
  client.requestSigningSMS(...args);
export const verifyAndSign = (...args: Parameters<typeof client.verifyAndSign>) =>
  client.verifyAndSign(...args);
export const startSMSSign = (...args: Parameters<typeof client.startSMSSign>) =>
  client.startSMSSign(...args);
export const cancelInvoice = (...args: Parameters<typeof client.cancelInvoice>) =>
  client.cancelInvoice(...args);

export const fetchTCMBRateTable = (baseDate?: Date) =>
  _fetchTCMBRateTable(baseDate, { fetch: tauriFetch });
