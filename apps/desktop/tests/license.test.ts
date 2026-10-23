import { describe, expect, test } from 'vitest';
import {
  activatedLicense,
  GRACE_PERIOD_MS,
  isUnlocked,
  LAST_SEEN_SAVE_INTERVAL_MS,
  LicenseError,
  normalizeLicenseKey,
  offlineStatus,
  parseStoredLicense,
  refreshLicense,
  resolveLicense,
  shouldSaveLicense,
  type LicenseStatus,
  type StoredLicense,
} from '../src/lib/license.ts';
import { createVault, parseVault } from '../src/lib/vault.ts';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const validatedAt = Date.parse('2026-10-01T09:00:00.000Z');
const iso = (time: number) => new Date(time).toISOString();

const stored: StoredLicense = {
  activationId: 'activation-1',
  customerEmail: 'mert@example.com',
  displayKey: '****-ABCD',
  expiresAt: null,
  key: 'ANGARIA-KEY',
  lastSeenAt: iso(validatedAt),
  lastValidatedAt: iso(validatedAt),
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
      lastSeenAt: iso(now),
      lastValidatedAt: iso(now),
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

  test('a valid answer resets a time seen ahead of a clock that was set back', () => {
    const license = { ...stored, lastSeenAt: iso(validatedAt + 5 * DAY) };
    const now = validatedAt + DAY;
    const result = resolveLicense(
      license,
      { details: { customerEmail: null, displayKey: '****-ABCD', expiresAt: null }, kind: 'valid' },
      now,
    );
    expect(result.license.lastSeenAt).toBe(iso(now));
    expect(refreshLicense(result.license, result.status, now + HOUR).status).toEqual({
      kind: 'valid',
    });
    expect(offlineStatus(result.license, now + HOUR)).toEqual({ daysLeft: 7, kind: 'grace' });
  });

  test('an invalid answer locks the app and keeps the stored license', () => {
    const now = validatedAt + DAY;
    const result = resolveLicense(stored, { kind: 'invalid' }, now);
    expect(result.status).toEqual({ kind: 'invalid' });
    expect(result.license).toEqual({ ...stored, lastSeenAt: iso(now) });
  });

  test('an invalid answer after the expiry date reads as expired', () => {
    const license = { ...stored, expiresAt: iso(validatedAt + DAY) };
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

  test('offline uses the grace period, keeps the last check time and records the time seen', () => {
    const now = validatedAt + DAY;
    const result = resolveLicense(stored, { kind: 'offline' }, now);
    expect(result.status).toEqual({ daysLeft: 6, kind: 'grace' });
    expect(result.license).toEqual({ ...stored, lastSeenAt: iso(now) });
  });

  test('offline with a clock behind the time seen needs an online check', () => {
    const license = { ...stored, lastSeenAt: iso(validatedAt + 5 * DAY) };
    const result = resolveLicense(license, { kind: 'offline' }, validatedAt + DAY);
    expect(result.status).toEqual({ kind: 'expired', reason: 'offline' });
    expect(result.license.lastSeenAt).toBe(license.lastSeenAt);
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

  test('a clock set back after the last check but before the time seen needs an online check', () => {
    const license = { ...stored, lastSeenAt: iso(validatedAt + 6 * DAY) };
    expect(offlineStatus(license, validatedAt + 6 * DAY)).toEqual({ daysLeft: 1, kind: 'grace' });
    expect(offlineStatus(license, validatedAt + 6 * DAY - 1)).toEqual({
      kind: 'expired',
      reason: 'offline',
    });
    expect(offlineStatus(license, validatedAt + DAY)).toEqual({
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

  test('an unreadable time seen needs an online check', () => {
    expect(offlineStatus({ ...stored, lastSeenAt: 'garbage' }, validatedAt + DAY)).toEqual({
      kind: 'expired',
      reason: 'offline',
    });
  });

  test('a passed expiry date wins over the grace period', () => {
    const expiresAt = iso(validatedAt + DAY);
    const license = { ...stored, expiresAt };
    expect(offlineStatus(license, validatedAt + DAY - 1)).toEqual({ daysLeft: 7, kind: 'grace' });
    expect(offlineStatus(license, validatedAt + DAY)).toEqual({
      kind: 'expired',
      reason: 'subscription',
    });
  });
});

describe('refreshLicense', () => {
  const grace = { daysLeft: 7, kind: 'grace' } as const;

  test('counts the grace period down and records the time seen', () => {
    const now = validatedAt + 2 * DAY + HOUR;
    expect(refreshLicense(stored, grace, now)).toEqual({
      license: { ...stored, lastSeenAt: iso(now) },
      status: { daysLeft: 5, kind: 'grace' },
    });
  });

  test('ends the grace period while the app stays open', () => {
    expect(refreshLicense(stored, grace, validatedAt + GRACE_PERIOD_MS + HOUR).status).toEqual({
      kind: 'expired',
      reason: 'offline',
    });
  });

  test('ends the grace period when the expiry date passes', () => {
    const license = { ...stored, expiresAt: iso(validatedAt + DAY) };
    expect(refreshLicense(license, grace, validatedAt + DAY).status).toEqual({
      kind: 'expired',
      reason: 'subscription',
    });
  });

  test('keeps a valid license valid until the next server check', () => {
    const now = validatedAt + 5 * HOUR;
    expect(refreshLicense(stored, { kind: 'valid' }, now)).toEqual({
      license: { ...stored, lastSeenAt: iso(now) },
      status: { kind: 'valid' },
    });
  });

  test('never moves the time seen back', () => {
    const license = { ...stored, lastSeenAt: iso(validatedAt + 3 * DAY) };
    const result = refreshLicense(license, grace, validatedAt + DAY);
    expect(result.license).toBe(license);
    expect(result.status).toEqual({ kind: 'expired', reason: 'offline' });
  });

  test('leaves an unreadable time seen for the next online check', () => {
    const license = { ...stored, lastSeenAt: 'garbage' };
    expect(refreshLicense(license, grace, validatedAt + DAY).license).toBe(license);
  });
});

describe('shouldSaveLicense', () => {
  test('saves a first license, a new status and every change but the time seen', () => {
    expect(shouldSaveLicense(null, stored, false)).toBe(true);
    expect(shouldSaveLicense(stored, stored, true)).toBe(true);
    expect(shouldSaveLicense(stored, { ...stored }, false)).toBe(false);
    expect(shouldSaveLicense(stored, { ...stored, expiresAt: iso(validatedAt + DAY) }, false)).toBe(
      true,
    );
    expect(
      shouldSaveLicense(stored, { ...stored, lastValidatedAt: iso(validatedAt + 1) }, false),
    ).toBe(true);
    expect(shouldSaveLicense(stored, { ...stored, displayKey: '****-WXYZ' }, false)).toBe(true);
    expect(shouldSaveLicense(stored, { ...stored, activationId: 'activation-2' }, false)).toBe(
      true,
    );
  });

  test('saves the time seen alone once a day, or when it moves back', () => {
    const seen = (time: number) => ({ ...stored, lastSeenAt: iso(time) });
    expect(shouldSaveLicense(stored, seen(validatedAt + HOUR), false)).toBe(false);
    expect(
      shouldSaveLicense(stored, seen(validatedAt + LAST_SEEN_SAVE_INTERVAL_MS - 1), false),
    ).toBe(false);
    expect(shouldSaveLicense(stored, seen(validatedAt + LAST_SEEN_SAVE_INTERVAL_MS), false)).toBe(
      true,
    );
    expect(shouldSaveLicense(seen(validatedAt + DAY), seen(validatedAt), false)).toBe(true);
    expect(shouldSaveLicense(stored, { ...stored, lastSeenAt: 'garbage' }, false)).toBe(true);
  });

  test('hourly recounts write once a day, and a clock set back is still caught', async () => {
    const backend = {
      stored: JSON.stringify({ gibPasswords: {}, license: stored, v: 1 }),
      writes: 0,
    };
    const vault = createVault({
      backend: {
        read: async () => backend.stored,
        write: async (json) => {
          backend.stored = json;
          backend.writes++;
        },
      },
      migrate: () => Promise.reject(new Error('no migration')),
    });
    let license = (await vault.getLicense())!;
    let status: LicenseStatus = { kind: 'valid' };

    for (let hour = 1; hour <= 30; hour++) {
      const next = refreshLicense(license, status, validatedAt + hour * HOUR);
      await vault.setLicense(next.license, {
        save: shouldSaveLicense(
          vault.savedLicense(),
          next.license,
          status.kind !== next.status.kind,
        ),
      });
      ({ license, status } = next);
    }

    expect(backend.writes).toBe(1);
    // In memory the time seen is current, so the app catches an hour set back at once.
    expect(license.lastSeenAt).toBe(iso(validatedAt + 30 * HOUR));
    expect(offlineStatus(license, validatedAt + 29 * HOUR)).toEqual({
      kind: 'expired',
      reason: 'offline',
    });
    // After a restart it counts from the saved time seen, at most a day behind.
    const saved = parseVault(backend.stored).license!;
    expect(saved.lastSeenAt).toBe(iso(validatedAt + DAY));
    expect(offlineStatus(saved, validatedAt + DAY - 1)).toEqual({
      kind: 'expired',
      reason: 'offline',
    });
  });
});

describe('activatedLicense', () => {
  test('stores the key and the activation and counts it as a successful check', () => {
    const now = validatedAt + 5;
    expect(
      activatedLicense(
        'ANGARIA-KEY-2',
        'activation-2',
        { customerEmail: null, displayKey: '****-ABCD', expiresAt: null },
        now,
      ),
    ).toEqual({
      activationId: 'activation-2',
      customerEmail: null,
      displayKey: '****-ABCD',
      expiresAt: null,
      key: 'ANGARIA-KEY-2',
      lastSeenAt: iso(now),
      lastValidatedAt: iso(now),
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
    expect(parseStoredLicense({ ...stored, key: '' })).toBeNull();
    const { lastValidatedAt: _, ...withoutCheck } = stored;
    expect(parseStoredLicense(withoutCheck)).toBeNull();
    const { key: _key, ...withoutKey } = stored;
    expect(parseStoredLicense(withoutKey)).toBeNull();
    const { lastSeenAt: _seen, ...withoutSeen } = stored;
    expect(parseStoredLicense(withoutSeen)).toBeNull();
  });
});

describe('LicenseError', () => {
  test('carries the code and a Turkish message', () => {
    const error = new LicenseError('limit-reached');
    expect(error.code).toBe('limit-reached');
    expect(error.message).toContain('Polar müşteri portalından bir Mac’i kaldırıp');
  });
});

describe('normalizeLicenseKey', () => {
  test('drops the spaces, line breaks, invisible characters and quotes of a paste', () => {
    expect(normalizeLicenseKey('  ANGARIA-1234-ABCD\n')).toBe('ANGARIA-1234-ABCD');
    expect(normalizeLicenseKey('ANGARIA-\u00a01234 -ABCD')).toBe('ANGARIA-1234-ABCD');
    expect(normalizeLicenseKey('\u200bANGARIA-1234\ufeff')).toBe('ANGARIA-1234');
    expect(normalizeLicenseKey('“ANGARIA-1234”')).toBe('ANGARIA-1234');
    expect(normalizeLicenseKey("'ANGARIA-1234'")).toBe('ANGARIA-1234');
  });

  test('keeps the key as it is otherwise, case included', () => {
    expect(normalizeLicenseKey('angaria-1234-abcd')).toBe('angaria-1234-abcd');
  });
});

describe('isUnlocked', () => {
  test('a valid license and its grace period open the app; MCP follows it', () => {
    for (const kind of ['valid', 'grace']) {
      expect(isUnlocked({ kind })).toBe(true);
    }
    for (const kind of ['checking', 'unlicensed', 'expired', 'invalid']) {
      expect(isUnlocked({ kind })).toBe(false);
    }
  });
});
