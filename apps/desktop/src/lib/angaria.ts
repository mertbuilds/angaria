import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { createClient } from 'angaria-earsiv-sdk';
import { fetchTCMBRates as _fetchTCMBRates } from 'angaria-utils';

export type { SessionInfo, InvoiceItem, InvoiceDetails } from 'angaria-earsiv-sdk';

const client = createClient({ fetch: tauriFetch });

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

export const fetchTCMBRates = (baseDate?: Date) => _fetchTCMBRates(baseDate, { fetch: tauriFetch });
