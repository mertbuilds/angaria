import { describe, expect, test } from 'vitest';
import {
  ENTITIES_STORAGE_KEY,
  LEGACY_CREDS_STORAGE_KEY,
  migrateCredentials,
} from '../src/lib/credentials.ts';

function memoryStorage(initial: Record<string, unknown>) {
  const data = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    read: (key: string): unknown => JSON.parse(data.get(key) ?? 'null'),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

function memoryVault({ fail = false } = {}) {
  const passwords = new Map<string, string>();
  const writes: Array<Record<string, string>> = [];
  return {
    passwords,
    vault: {
      savePasswords: async (next: Record<string, string>) => {
        if (fail) {
          throw new Error('keychain unavailable');
        }
        writes.push(next);
        for (const [id, password] of Object.entries(next)) {
          passwords.set(id, password);
        }
      },
    },
    writes,
  };
}

const entity = (id: string, creds: Record<string, unknown>) => ({
  companyInfo: { name: `Firma ${id}` },
  creds,
  id,
  name: `Varlık ${id}`,
});

describe('migrateCredentials', () => {
  test('moves every entity password to the vault in one write and strips it from localStorage', async () => {
    const storage = memoryStorage({
      [ENTITIES_STORAGE_KEY]: [
        entity('a', { password: 'secret-a', testMode: false, username: 'user-a' }),
        entity('b', { password: 'secret-b', testMode: true, username: 'user-b' }),
      ],
    });
    const { passwords, vault, writes } = memoryVault();

    const result = await migrateCredentials(storage, vault);

    expect(result).toEqual({ failed: 0, migrated: 2 });
    expect(writes).toHaveLength(1);
    expect(passwords.get('a')).toBe('secret-a');
    expect(passwords.get('b')).toBe('secret-b');
    expect(storage.read(ENTITIES_STORAGE_KEY)).toEqual([
      entity('a', { testMode: false, username: 'user-a' }),
      entity('b', { testMode: true, username: 'user-b' }),
    ]);
  });

  test('is idempotent', async () => {
    const storage = memoryStorage({
      [ENTITIES_STORAGE_KEY]: [entity('a', { password: 'secret', testMode: true, username: 'u' })],
      [LEGACY_CREDS_STORAGE_KEY]: { password: 'old', testMode: true, username: 'u' },
    });
    const { passwords, vault, writes } = memoryVault();

    await migrateCredentials(storage, vault);
    const entitiesAfterFirst = storage.read(ENTITIES_STORAGE_KEY);
    const legacyAfterFirst = storage.read(LEGACY_CREDS_STORAGE_KEY);
    const second = await migrateCredentials(storage, vault);

    expect(second).toEqual({ failed: 0, migrated: 0 });
    expect(writes).toHaveLength(1);
    expect(storage.read(ENTITIES_STORAGE_KEY)).toEqual(entitiesAfterFirst);
    expect(storage.read(LEGACY_CREDS_STORAGE_KEY)).toEqual(legacyAfterFirst);
    expect(passwords.get('a')).toBe('secret');
  });

  test('keeps the plaintext passwords when the vault write fails', async () => {
    const storage = memoryStorage({
      [ENTITIES_STORAGE_KEY]: [
        entity('a', { password: 'secret-a', testMode: true, username: 'user-a' }),
        entity('b', { password: '', testMode: true, username: 'user-b' }),
      ],
    });
    const { passwords, vault } = memoryVault({ fail: true });

    const result = await migrateCredentials(storage, vault);

    expect(result).toEqual({ error: new Error('keychain unavailable'), failed: 1, migrated: 0 });
    expect(passwords.size).toBe(0);
    expect(storage.read(ENTITIES_STORAGE_KEY)).toEqual([
      entity('a', { password: 'secret-a', testMode: true, username: 'user-a' }),
      entity('b', { testMode: true, username: 'user-b' }),
    ]);
  });

  test('retries on the next run', async () => {
    const storage = memoryStorage({
      [ENTITIES_STORAGE_KEY]: [entity('a', { password: 'secret', testMode: true, username: 'u' })],
    });

    await migrateCredentials(storage, memoryVault({ fail: true }).vault);
    const { passwords, vault } = memoryVault();
    const result = await migrateCredentials(storage, vault);

    expect(result).toEqual({ failed: 0, migrated: 1 });
    expect(passwords.get('a')).toBe('secret');
    expect(storage.read(ENTITIES_STORAGE_KEY)).toEqual([
      entity('a', { testMode: true, username: 'u' }),
    ]);
  });

  test('strips an empty password without writing to the vault', async () => {
    const storage = memoryStorage({
      [ENTITIES_STORAGE_KEY]: [entity('a', { password: '', testMode: true, username: '' })],
    });
    const { vault, writes } = memoryVault();

    const result = await migrateCredentials(storage, vault);

    expect(result).toEqual({ failed: 0, migrated: 0 });
    expect(writes).toHaveLength(0);
    expect(storage.read(ENTITIES_STORAGE_KEY)).toEqual([
      entity('a', { testMode: true, username: '' }),
    ]);
  });

  test('strips the stale legacy password once entities exist', async () => {
    const storage = memoryStorage({
      [ENTITIES_STORAGE_KEY]: [entity('a', { testMode: true, username: 'u' })],
      [LEGACY_CREDS_STORAGE_KEY]: { password: 'old', testMode: false, username: 'u' },
    });
    const { vault, writes } = memoryVault();

    await migrateCredentials(storage, vault);

    expect(writes).toHaveLength(0);
    expect(storage.read(LEGACY_CREDS_STORAGE_KEY)).toEqual({ testMode: false, username: 'u' });
  });

  test('leaves the legacy password alone when no entities exist', async () => {
    const legacy = { password: 'only-copy', testMode: true, username: 'u' };
    const storage = memoryStorage({ [LEGACY_CREDS_STORAGE_KEY]: legacy });
    const { vault } = memoryVault();

    const result = await migrateCredentials(storage, vault);

    expect(result).toEqual({ failed: 0, migrated: 0 });
    expect(storage.read(LEGACY_CREDS_STORAGE_KEY)).toEqual(legacy);
  });

  test('ignores unreadable storage', async () => {
    const storage = memoryStorage({});
    storage.setItem(ENTITIES_STORAGE_KEY, '{not json');
    const { vault } = memoryVault();

    await expect(migrateCredentials(storage, vault)).resolves.toEqual({ failed: 0, migrated: 0 });
    expect(storage.getItem(ENTITIES_STORAGE_KEY)).toBe('{not json');
  });
});
