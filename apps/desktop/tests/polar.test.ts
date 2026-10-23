import { describe, expect, test, vi } from 'vitest';
import { createPolarClient } from '../src/lib/polar.ts';

const ORGANIZATION_ID = '904c54ce-20e8-4a7e-bee9-fef5f8990517';

const licenseKey = {
  customer: { email: 'mert@example.com' },
  display_key: '****-ABCD',
  expires_at: null,
  status: 'granted',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });

const polarError = (status: number, error: string, detail: string) =>
  json({ detail, error }, status);

function client(respond: () => Promise<Response> | Response, timeoutMs?: number) {
  const fetch = vi.fn((_input: string, _init: RequestInit) => Promise.resolve(respond()));
  return {
    fetch,
    polar: createPolarClient({
      apiBase: 'https://sandbox-api.polar.sh/',
      fetch,
      organizationId: ORGANIZATION_ID,
      timeoutMs,
    }),
  };
}

describe('validate', () => {
  test('posts key, activation and organization to the customer portal endpoint', async () => {
    const { fetch, polar } = client(() => json(licenseKey));
    await polar.validate('ANGARIA-KEY', 'activation-1');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://sandbox-api.polar.sh/v1/customer-portal/license-keys/validate');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      activation_id: 'activation-1',
      key: 'ANGARIA-KEY',
      organization_id: ORGANIZATION_ID,
    });
  });

  test('a granted key is valid', async () => {
    const { polar } = client(() => json({ ...licenseKey, expires_at: '2027-10-01T00:00:00Z' }));
    expect(await polar.validate('key', 'activation')).toEqual({
      details: {
        customerEmail: 'mert@example.com',
        displayKey: '****-ABCD',
        expiresAt: '2027-10-01T00:00:00Z',
      },
      kind: 'valid',
    });
  });

  test('a revoked key is inactive', async () => {
    const { polar } = client(() => json({ ...licenseKey, status: 'revoked' }));
    expect(await polar.validate('key', 'activation')).toEqual({ kind: 'inactive' });
  });

  test('404 is invalid', async () => {
    const { polar } = client(() => polarError(404, 'ResourceNotFound', 'Not found'));
    expect(await polar.validate('key', 'activation')).toEqual({ kind: 'invalid' });
  });

  test('404 for an inactive or expired key is inactive', async () => {
    for (const detail of ['License key is no longer active.', 'License key has expired.']) {
      const { polar } = client(() => polarError(404, 'ResourceNotFound', detail));
      expect(await polar.validate('key', 'activation')).toEqual({ kind: 'inactive' });
    }
  });

  test('other Polar errors are invalid', async () => {
    const { polar } = client(() => json({ detail: [], error: 'RequestValidationError' }, 422));
    expect(await polar.validate('key', 'activation')).toEqual({ kind: 'invalid' });
  });

  test('server errors, rate limits and network errors are offline', async () => {
    const responses = [
      () => polarError(500, 'InternalServerError', 'boom'),
      () => new Response('Bad gateway', { status: 502 }),
      () => polarError(429, 'TooManyRequests', 'slow down'),
      () => Promise.reject(new TypeError('network down')),
    ];
    for (const respond of responses) {
      const { polar } = client(respond);
      expect(await polar.validate('key', 'activation')).toEqual({ kind: 'offline' });
    }
  });

  test('answers that are not from Polar are offline', async () => {
    const responses = [
      () => new Response('<html>Wi-Fi login</html>', { status: 200 }),
      () => new Response('<html>Not found</html>', { status: 404 }),
      () => json({ unexpected: true }),
    ];
    for (const respond of responses) {
      const { polar } = client(respond);
      expect(await polar.validate('key', 'activation')).toEqual({ kind: 'offline' });
    }
  });

  test('a request that hangs past the timeout is offline and aborted', async () => {
    let signal: AbortSignal | null | undefined;
    const fetch = vi.fn((_input: string, init: RequestInit) => {
      signal = init.signal;
      return new Promise<Response>(() => {});
    });
    const polar = createPolarClient({
      apiBase: 'https://sandbox-api.polar.sh',
      fetch,
      organizationId: ORGANIZATION_ID,
      timeoutMs: 10,
    });
    expect(await polar.validate('key', 'activation')).toEqual({ kind: 'offline' });
    expect(signal?.aborted).toBe(true);
  });
});

describe('activate', () => {
  test('returns the activation id and license details', async () => {
    const { fetch, polar } = client(() =>
      json({ id: 'activation-1', label: 'mac', license_key: licenseKey }),
    );
    expect(await polar.activate('ANGARIA-KEY', 'mac')).toEqual({
      activationId: 'activation-1',
      details: { customerEmail: 'mert@example.com', displayKey: '****-ABCD', expiresAt: null },
      kind: 'activated',
    });
    expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toEqual({
      key: 'ANGARIA-KEY',
      label: 'mac',
      organization_id: ORGANIZATION_ID,
    });
  });

  test('403 at the activation limit is limit-reached', async () => {
    const { polar } = client(() =>
      polarError(403, 'NotPermitted', 'License key activation limit already reached'),
    );
    expect(await polar.activate('key', 'mac')).toEqual({ kind: 'limit-reached' });
  });

  test('403 for an inactive or expired key is inactive', async () => {
    for (const detail of [
      'License key is no longer active. This license key can not be activated.',
      'License key has expired.',
    ]) {
      const { polar } = client(() => polarError(403, 'NotPermitted', detail));
      expect(await polar.activate('key', 'mac')).toEqual({ kind: 'inactive' });
    }
  });

  test('404 is invalid, other Polar errors are rejected', async () => {
    expect(
      await client(() => polarError(404, 'ResourceNotFound', 'Not found')).polar.activate('k', 'm'),
    ).toEqual({ kind: 'invalid' });
    expect(
      await client(() => json({ detail: [], error: 'RequestValidationError' }, 422)).polar.activate(
        'k',
        'm',
      ),
    ).toEqual({ kind: 'rejected' });
  });

  test('network errors are offline', async () => {
    const { polar } = client(() => Promise.reject(new TypeError('network down')));
    expect(await polar.activate('key', 'mac')).toEqual({ kind: 'offline' });
  });
});

describe('deactivate', () => {
  test('204 deactivates', async () => {
    const { fetch, polar } = client(() => new Response(null, { status: 204 }));
    expect(await polar.deactivate('ANGARIA-KEY', 'activation-1')).toEqual({
      kind: 'deactivated',
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://sandbox-api.polar.sh/v1/customer-portal/license-keys/deactivate');
    expect(JSON.parse(String(init.body))).toEqual({
      activation_id: 'activation-1',
      key: 'ANGARIA-KEY',
      organization_id: ORGANIZATION_ID,
    });
  });

  test('404 means the activation is already gone', async () => {
    const { polar } = client(() => polarError(404, 'ResourceNotFound', 'Not found'));
    expect(await polar.deactivate('key', 'activation')).toEqual({ kind: 'deactivated' });
  });

  test('network errors are offline and keep the activation', async () => {
    const { polar } = client(() => Promise.reject(new TypeError('network down')));
    expect(await polar.deactivate('key', 'activation')).toEqual({ kind: 'offline' });
  });
});
