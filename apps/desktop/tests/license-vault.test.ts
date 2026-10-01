import { describe, expect, test } from 'vitest';
import type { SecretStore } from '../src/lib/credentials.ts';
import {
  clearLicense,
  LEGACY_LICENSE_SECRET_KEY,
  LEGACY_LICENSE_STORAGE_KEY,
  LICENSE_SECRET_KEY,
  loadLicense,
  saveLicense,
} from '../src/lib/license-vault.ts';
import type { StoredLicense } from '../src/lib/license.ts';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

function memorySecrets(initial: Record<string, string> = {}, { failSet = false } = {}) {
  const items = new Map(Object.entries(initial));
  const secrets: SecretStore = {
    delete: async (key) => {
      items.delete(key);
    },
    get: async (key) => items.get(key) ?? null,
    set: async (key, value) => {
      if (failSet) {
        throw new Error('keychain unavailable');
      }
      items.set(key, value);
    },
  };
  return { items, secrets };
}

const license: StoredLicense = {
  activationId: 'activation-1',
  customerEmail: 'mert@example.com',
  displayKey: '****-ABCD',
  expiresAt: null,
  key: 'ANGARIA-KEY',
  lastSeenAt: '2026-10-02T09:00:00.000Z',
  lastValidatedAt: '2026-10-01T09:00:00.000Z',
};

const { key: _key, lastSeenAt: _seen, ...legacyRecord } = license;

describe('license vault', () => {
  test('keeps the whole record in one keychain item', async () => {
    const { items, secrets } = memorySecrets();
    await saveLicense(secrets, license);
    expect([...items.keys()]).toEqual([LICENSE_SECRET_KEY]);
    expect(JSON.parse(items.get(LICENSE_SECRET_KEY)!)).toEqual(license);
    expect(await loadLicense(secrets, memoryStorage())).toEqual(license);
  });

  test('loads nothing when there is no license', async () => {
    expect(await loadLicense(memorySecrets().secrets, memoryStorage())).toBeNull();
  });

  test('reads an unreadable item as no license', async () => {
    const { secrets } = memorySecrets({ [LICENSE_SECRET_KEY]: '{not json' });
    expect(await loadLicense(secrets, memoryStorage())).toBeNull();
    const partial = memorySecrets({ [LICENSE_SECRET_KEY]: JSON.stringify(legacyRecord) });
    expect(await loadLicense(partial.secrets, memoryStorage())).toBeNull();
  });

  test('clear removes the item', async () => {
    const { items, secrets } = memorySecrets({ [LICENSE_SECRET_KEY]: JSON.stringify(license) });
    await clearLicense(secrets);
    expect(items.size).toBe(0);
  });
});

describe('legacy migration', () => {
  test('moves the localStorage record and the keychain key into one item, once', async () => {
    const storage = memoryStorage({ [LEGACY_LICENSE_STORAGE_KEY]: JSON.stringify(legacyRecord) });
    const { items, secrets } = memorySecrets({ [LEGACY_LICENSE_SECRET_KEY]: 'ANGARIA-KEY' });
    const migrated = { ...license, lastSeenAt: license.lastValidatedAt };

    expect(await loadLicense(secrets, storage)).toEqual(migrated);
    expect(JSON.parse(items.get(LICENSE_SECRET_KEY)!)).toEqual(migrated);
    expect(items.has(LEGACY_LICENSE_SECRET_KEY)).toBe(false);
    expect(storage.data.size).toBe(0);

    expect(await loadLicense(secrets, storage)).toEqual(migrated);
  });

  test('drops a legacy record without its key', async () => {
    const storage = memoryStorage({ [LEGACY_LICENSE_STORAGE_KEY]: JSON.stringify(legacyRecord) });
    const { items, secrets } = memorySecrets();

    expect(await loadLicense(secrets, storage)).toBeNull();
    expect(items.size).toBe(0);
    expect(storage.data.size).toBe(0);
  });

  test('drops an unreadable legacy record and its key', async () => {
    const storage = memoryStorage({ [LEGACY_LICENSE_STORAGE_KEY]: '{not json' });
    const { items, secrets } = memorySecrets({ [LEGACY_LICENSE_SECRET_KEY]: 'ANGARIA-KEY' });

    expect(await loadLicense(secrets, storage)).toBeNull();
    expect(items.size).toBe(0);
    expect(storage.data.size).toBe(0);
  });

  test('keeps the legacy copies when the keychain write fails', async () => {
    const storage = memoryStorage({ [LEGACY_LICENSE_STORAGE_KEY]: JSON.stringify(legacyRecord) });
    const { items, secrets } = memorySecrets(
      { [LEGACY_LICENSE_SECRET_KEY]: 'ANGARIA-KEY' },
      { failSet: true },
    );

    await expect(loadLicense(secrets, storage)).rejects.toThrow('keychain unavailable');
    expect(items.get(LEGACY_LICENSE_SECRET_KEY)).toBe('ANGARIA-KEY');
    expect(storage.data.has(LEGACY_LICENSE_STORAGE_KEY)).toBe(true);
  });

  test('ignores legacy copies once the item exists', async () => {
    const storage = memoryStorage({ [LEGACY_LICENSE_STORAGE_KEY]: JSON.stringify(legacyRecord) });
    const { secrets } = memorySecrets({
      [LEGACY_LICENSE_SECRET_KEY]: 'OLD-KEY',
      [LICENSE_SECRET_KEY]: JSON.stringify(license),
    });

    expect(await loadLicense(secrets, storage)).toEqual(license);
  });
});
