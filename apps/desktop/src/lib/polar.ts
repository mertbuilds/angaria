import type { LicenseDetails, LicenseErrorCode, ValidationOutcome } from './license.ts';

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

export interface PolarClientOptions {
  apiBase: string;
  fetch: Fetch;
  organizationId: string;
  timeoutMs?: number;
}

export type ActivateResult =
  | { activationId: string; details: LicenseDetails; kind: 'activated' }
  | { kind: LicenseErrorCode };

export type DeactivateResult = { kind: 'deactivated' } | { kind: 'offline' | 'rejected' };

type PolarResponse = { kind: 'offline' } | { body: unknown; kind: 'response'; status: number };

const INACTIVE_DETAIL = /no longer active|expired/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Polar errors are JSON with an `error` name. Anything else (a captive portal,
// a proxy page) is not an answer from Polar and counts as offline.
const isPolarError = (body: unknown): body is { detail?: unknown; error: string } =>
  isRecord(body) && typeof body.error === 'string';

const isInactiveError = (body: { detail?: unknown }) =>
  typeof body.detail === 'string' && INACTIVE_DETAIL.test(body.detail);

function parseDetails(value: unknown): LicenseDetails | null {
  if (!isRecord(value) || typeof value.display_key !== 'string') {
    return null;
  }
  const customer = isRecord(value.customer) ? value.customer : {};
  return {
    customerEmail: typeof customer.email === 'string' ? customer.email : null,
    displayKey: value.display_key,
    expiresAt: typeof value.expires_at === 'string' ? value.expires_at : null,
  };
}

export function createPolarClient({
  apiBase,
  fetch,
  organizationId,
  timeoutMs = 10_000,
}: PolarClientOptions) {
  const baseUrl = `${apiBase.replace(/\/+$/, '')}/v1/customer-portal/license-keys`;

  async function post(path: string, payload: Record<string, string>): Promise<PolarResponse> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<PolarResponse>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve({ kind: 'offline' });
      }, timeoutMs);
    });
    const request = async (): Promise<PolarResponse> => {
      const response = await fetch(`${baseUrl}/${path}`, {
        body: JSON.stringify({ ...payload, organization_id: organizationId }),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      });
      if (response.status === 429 || response.status >= 500) {
        return { kind: 'offline' };
      }
      const text = await response.text();
      return { body: text ? JSON.parse(text) : null, kind: 'response', status: response.status };
    };
    try {
      return await Promise.race([request(), timeout]);
    } catch {
      return { kind: 'offline' };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async activate(key: string, label: string): Promise<ActivateResult> {
      const response = await post('activate', { key, label });
      if (response.kind === 'offline') {
        return { kind: 'offline' };
      }
      const { body, status } = response;
      if (status === 200 && isRecord(body) && typeof body.id === 'string') {
        const details = parseDetails(body.license_key);
        return details
          ? { activationId: body.id, details, kind: 'activated' }
          : { kind: 'offline' };
      }
      if (!isPolarError(body)) {
        return { kind: 'offline' };
      }
      if (status === 403) {
        return { kind: isInactiveError(body) ? 'inactive' : 'limit-reached' };
      }
      return { kind: status === 404 ? 'invalid' : 'rejected' };
    },

    async deactivate(key: string, activationId: string): Promise<DeactivateResult> {
      const response = await post('deactivate', { activation_id: activationId, key });
      if (response.kind === 'offline') {
        return { kind: 'offline' };
      }
      const { body, status } = response;
      // 404: the activation is already gone (removed in the customer portal).
      if (status === 204 || (status === 404 && isPolarError(body))) {
        return { kind: 'deactivated' };
      }
      return { kind: isPolarError(body) ? 'rejected' : 'offline' };
    },

    async validate(key: string, activationId: string): Promise<ValidationOutcome> {
      const response = await post('validate', { activation_id: activationId, key });
      if (response.kind === 'offline') {
        return { kind: 'offline' };
      }
      const { body, status } = response;
      if (status === 200) {
        const details = parseDetails(body);
        if (!details) {
          return { kind: 'offline' };
        }
        return isRecord(body) && body.status === 'granted'
          ? { details, kind: 'valid' }
          : { kind: 'inactive' };
      }
      if (!isPolarError(body)) {
        return { kind: 'offline' };
      }
      return { kind: status === 404 && isInactiveError(body) ? 'inactive' : 'invalid' };
    },
  };
}
