import { isTauri } from '@tauri-apps/api/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { createClient } from 'angaria-earsiv-sdk';
import { fetchTCMBRateTable as _fetchTCMBRateTable } from 'angaria-utils';
import { activeGibEmulatorURL } from './gib-emulator.ts';
import { readRateDay, type RateDay } from './rate-day.ts';

export type { InvoiceDetails } from 'angaria-earsiv-sdk';

// Dev only: with the Emülatör switch on (src/lib/gib-emulator.ts), GİB and TCMB
// calls go to the local emulator. A plain browser has no Tauri http plugin and
// reaches it with its own fetch; the emulator allows CORS.
const hostFetch: typeof tauriFetch =
  activeGibEmulatorURL && !isTauri() ? (input, init) => fetch(input, init) : tauriFetch;

// Dev only: VITE_GIB_FIXTURES=1 answers GİB calls from src/dev/gib-fixtures.ts,
// for the screens in a plain browser. import.meta.env.DEV is statically false
// in production builds, so the fixtures never ship.
const gibFetch: typeof tauriFetch =
  import.meta.env.DEV && import.meta.env.VITE_GIB_FIXTURES === '1'
    ? (input, init) =>
        import('../dev/gib-fixtures.ts').then(({ fixtureFetch }) => fixtureFetch(input, init))
    : hostFetch;

const client = createClient({ baseUrl: activeGibEmulatorURL, fetch: gibFetch });

export const login = (...args: Parameters<typeof client.login>) => client.login(...args);
export const logout = (...args: Parameters<typeof client.logout>) => client.logout(...args);
export const forceLogout = (...args: Parameters<typeof client.forceLogout>) =>
  client.forceLogout(...args);
export const createDraftInvoice = (...args: Parameters<typeof client.createDraftInvoice>) =>
  client.createDraftInvoice(...args);
export const getInvoiceDetail = (...args: Parameters<typeof client.getInvoiceDetail>) =>
  client.getInvoiceDetail(...args);
export const getInvoiceHTML = (...args: Parameters<typeof client.getInvoiceHTML>) =>
  client.getInvoiceHTML(...args);
export const downloadInvoice = (...args: Parameters<typeof client.downloadInvoice>) =>
  client.downloadInvoice(...args);
export const getDrafts = (...args: Parameters<typeof client.getDrafts>) =>
  client.getDrafts(...args);
export const verifyAndSign = (...args: Parameters<typeof client.verifyAndSign>) =>
  client.verifyAndSign(...args);
export const startSMSSign = (...args: Parameters<typeof client.startSMSSign>) =>
  client.startSMSSign(...args);
export const cancelInvoice = (...args: Parameters<typeof client.cancelInvoice>) =>
  client.cancelInvoice(...args);

/**
 * The TCMB bulletin for an invoice dated `baseDate` (default today), by the
 * Kur günü setting unless `rateDay` is given. Put `rateDay` in the query key.
 */
export const fetchTCMBRateTable = (baseDate?: Date, rateDay: RateDay = readRateDay()) =>
  _fetchTCMBRateTable(baseDate, { baseUrl: activeGibEmulatorURL, fetch: hostFetch, rateDay });
