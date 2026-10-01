import { describe, expect, test } from 'vitest';
import {
  activatedLicense,
  GRACE_PERIOD_MS,
  LicenseError,
  offlineStatus,
  parseStoredLicense,
  resolveLicense,
  type StoredLicense,
} from '../src/lib/license.ts';

const DAY = 24 * 60 * 60 * 1000;
const validatedAt = Date.parse('2026-10-01T09:00:00.000Z');

const stored: StoredLicense = {
  activationId: 'activation-1',
  customerEmail: 'mert@example.com',
  displayKey: '****-ABCD',
  expiresAt: null,
  lastValidatedAt: new Date(validatedAt).toISOString(),
};

describe('resolveLicense', () => {
  test('a valid answer records the check time and fresh details', () => {
    const now = validatedAt + 3 * DAY;
    const result = resolveLicense(
      stored,
      {
        details: { customerEmail: 'new@example.com', displayKey: '****-WXYZ', expiresAt: null },
        kind: 'valid',
      },
      now,
    );
    expect(result.status).toEqual({ kind: 'valid' });
    expect(result.license).toEqual({
      ...stored,
      customerEmail: 'new@example.com',
      displayKey: '****-WXYZ',
      lastValidatedAt: new Date(now).toISOString(),
    });
  });

  test('a valid answer wins over a local expiry date', () => {
    const license = { ...stored, expiresAt: '2026-09-01T00:00:00.000Z' };
    const result = resolveLicense(
      license,
      { details: { ...license, expiresAt: null }, kind: 'valid' },
      validatedAt,
    );
    expect(result.status).toEqual({ kind: 'valid' });
  });

  test('an invalid answer locks the app and keeps the stored license', () => {
    const result = resolveLicense(stored, { kind: 'invalid' }, validatedAt + DAY);
    expect(result.status).toEqual({ kind: 'invalid' });
    expect(result.license).toBe(stored);
  });

  test('an invalid answer after the expiry date reads as expired', () => {
    const license = { ...stored, expiresAt: new Date(validatedAt + DAY).toISOString() };
    expect(resolveLicense(license, { kind: 'invalid' }, validatedAt + DAY).status).toEqual({
      kind: 'expired',
      reason: 'subscription',
    });
  });

  test('an inactive key reads as an expired subscription', () => {
    expect(resolveLicense(stored, { kind: 'inactive' }, validatedAt).status).toEqual({
      kind: 'expired',
      reason: 'subscription',
    });
  });

  test('offline uses the grace period and keeps the last check time', () => {
    const result = resolveLicense(stored, { kind: 'offline' }, validatedAt + DAY);
    expect(result.status).toEqual({ daysLeft: 6, kind: 'grace' });
    expect(result.license).toBe(stored);
  });
});

describe('offlineStatus', () => {
  test('right after a check the full grace period is left', () => {
    expect(offlineStatus(stored, validatedAt)).toEqual({ daysLeft: 7, kind: 'grace' });
    expect(offlineStatus(stored, validatedAt + 1)).toEqual({ daysLeft: 7, kind: 'grace' });
  });

  test('partial days round up', () => {
    expect(offlineStatus(stored, validatedAt + 6.5 * DAY)).toEqual({ daysLeft: 1, kind: 'grace' });
  });

  test('exactly 7 days after the last check is still usable', () => {
    expect(offlineStatus(stored, validatedAt + GRACE_PERIOD_MS)).toEqual({
      daysLeft: 0,
      kind: 'grace',
    });
  });

  test('one millisecond past 7 days needs an online check', () => {
    expect(offlineStatus(stored, validatedAt + GRACE_PERIOD_MS + 1)).toEqual({
      kind: 'expired',
      reason: 'offline',
    });
  });

  test('a clock earlier than the last check needs an online check', () => {
    expect(offlineStatus(stored, validatedAt - 1)).toEqual({ kind: 'expired', reason: 'offline' });
    expect(offlineStatus(stored, validatedAt - 30 * DAY)).toEqual({
      kind: 'expired',
      reason: 'offline',
    });
  });

  test('an unreadable last check time needs an online check', () => {
    expect(offlineStatus({ ...stored, lastValidatedAt: 'garbage' }, validatedAt)).toEqual({
      kind: 'expired',
      reason: 'offline',
    });
  });

  test('a passed expiry date wins over the grace period', () => {
    const expiresAt = new Date(validatedAt + DAY).toISOString();
    const license = { ...stored, expiresAt };
    expect(offlineStatus(license, validatedAt + DAY - 1)).toEqual({ daysLeft: 7, kind: 'grace' });
    expect(offlineStatus(license, validatedAt + DAY)).toEqual({
      kind: 'expired',
      reason: 'subscription',
    });
  });
});

describe('activatedLicense', () => {
  test('stores the activation and counts it as a successful check', () => {
    const now = validatedAt + 5;
    expect(
      activatedLicense(
        'activation-2',
        { customerEmail: null, displayKey: '****-ABCD', expiresAt: null },
        now,
      ),
    ).toEqual({
      activationId: 'activation-2',
      customerEmail: null,
      displayKey: '****-ABCD',
      expiresAt: null,
      lastValidatedAt: new Date(now).toISOString(),
    });
  });
});

describe('parseStoredLicense', () => {
  test('accepts a stored license', () => {
    expect(parseStoredLicense(structuredClone(stored))).toEqual(stored);
  });

  test('rejects missing or malformed data', () => {
    expect(parseStoredLicense(null)).toBeNull();
    expect(parseStoredLicense('license')).toBeNull();
    expect(parseStoredLicense({ ...stored, activationId: 1 })).toBeNull();
    expect(parseStoredLicense({ ...stored, expiresAt: 5 })).toBeNull();
    const { lastValidatedAt: _, ...withoutCheck } = stored;
    expect(parseStoredLicense(withoutCheck)).toBeNull();
  });
});

describe('LicenseError', () => {
  test('carries the code and a Turkish message', () => {
    const error = new LicenseError('limit-reached');
    expect(error.code).toBe('limit-reached');
    expect(error.message).toContain('Polar müşteri portalından bir cihazı kaldırıp');
  });
});
