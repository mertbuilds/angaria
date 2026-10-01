import { describe, expect, test } from 'vitest';
import {
  createPasswordVault,
  ENTITIES_STORAGE_KEY,
  LEGACY_CREDS_STORAGE_KEY,
  migrateCredentials,
  passwordKey,
  type SecretStore,
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

function memorySecrets({ failOn = [] }: { failOn?: Array<string> } = {}) {
  const items = new Map<string, string>();
  const secrets: SecretStore = {
    delete: async (key) => {
      items.delete(key);
    },
    get: async (key) => items.get(key) ?? null,
    set: async (key, value) => {
      if (failOn.includes(key)) {
        throw new Error('keychain unavailable');
      }
      items.set(key, value);
    },
  };
  return { items, secrets };
}

const entity = (id: string, creds: Record<string, unknown>) => ({
  companyInfo: { name: `Firma ${id}` },
  creds,
  id,
  name: `Varlık ${id}`,
});

describe('migrateCredentials', () => {
  test('moves each entity password to the keychain and strips it from localStorage', async () => {
    const storage = memoryStorage({
      [ENTITIES_STORAGE_KEY]: [
        entity('a', { password: 'secret-a', testMode: false, username: 'user-a' }),
        entity('b', { password: 'secret-b', testMode: true, username: 'user-b' }),
      ],
    });
    const { items, secrets } = memorySecrets();

    const result = await migrateCredentials(storage, secrets);

    expect(result).toEqual({ failed: 0, migrated: 2 });
    expect(items.get(passwordKey('a'))).toBe('secret-a');
    expect(items.get(passwordKey('b'))).toBe('secret-b');
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
    const { items, secrets } = memorySecrets();

    await migrateCredentials(storage, secrets);
    const entitiesAfterFirst = storage.read(ENTITIES_STORAGE_KEY);
    const legacyAfterFirst = storage.read(LEGACY_CREDS_STORAGE_KEY);
    const second = await migrateCredentials(storage, secrets);

    expect(second).toEqual({ failed: 0, migrated: 0 });
    expect(storage.read(ENTITIES_STORAGE_KEY)).toEqual(entitiesAfterFirst);
    expect(storage.read(LEGACY_CREDS_STORAGE_KEY)).toEqual(legacyAfterFirst);
    expect(items.get(passwordKey('a'))).toBe('secret');
  });

  test('keeps the plaintext password when the keychain write fails', async () => {
    const storage = memoryStorage({
      [ENTITIES_STORAGE_KEY]: [
        entity('a', { password: 'secret-a', testMode: true, username: 'user-a' }),
        entity('b', { password: 'secret-b', testMode: true, username: 'user-b' }),
      ],
    });
    const { items, secrets } = memorySecrets({ failOn: [passwordKey('a')] });

    const result = await migrateCredentials(storage, secrets);

    expect(result).toEqual({ failed: 1, migrated: 1 });
    expect(items.has(passwordKey('a'))).toBe(false);
    expect(storage.read(ENTITIES_STORAGE_KEY)).toEqual([
      entity('a', { password: 'secret-a', testMode: true, username: 'user-a' }),
      entity('b', { testMode: true, username: 'user-b' }),
    ]);
  });

  test('retries a failed entity on the next run', async () => {
    const storage = memoryStorage({
      [ENTITIES_STORAGE_KEY]: [entity('a', { password: 'secret', testMode: true, username: 'u' })],
    });

    await migrateCredentials(storage, memorySecrets({ failOn: [passwordKey('a')] }).secrets);
    const { items, secrets } = memorySecrets();
    const result = await migrateCredentials(storage, secrets);

    expect(result).toEqual({ failed: 0, migrated: 1 });
    expect(items.get(passwordKey('a'))).toBe('secret');
    expect(storage.read(ENTITIES_STORAGE_KEY)).toEqual([
      entity('a', { testMode: true, username: 'u' }),
    ]);
  });

  test('strips an empty password without writing to the keychain', async () => {
    const storage = memoryStorage({
      [ENTITIES_STORAGE_KEY]: [entity('a', { password: '', testMode: true, username: '' })],
    });
    const { items, secrets } = memorySecrets();

    const result = await migrateCredentials(storage, secrets);

    expect(result).toEqual({ failed: 0, migrated: 0 });
    expect(items.size).toBe(0);
    expect(storage.read(ENTITIES_STORAGE_KEY)).toEqual([
      entity('a', { testMode: true, username: '' }),
    ]);
  });

  test('strips the stale legacy password once entities exist', async () => {
    const storage = memoryStorage({
      [ENTITIES_STORAGE_KEY]: [entity('a', { testMode: true, username: 'u' })],
      [LEGACY_CREDS_STORAGE_KEY]: { password: 'old', testMode: false, username: 'u' },
    });
    const { items, secrets } = memorySecrets();

    await migrateCredentials(storage, secrets);

    expect(items.size).toBe(0);
    expect(storage.read(LEGACY_CREDS_STORAGE_KEY)).toEqual({ testMode: false, username: 'u' });
  });

  test('leaves the legacy password alone when no entities exist', async () => {
    const legacy = { password: 'only-copy', testMode: true, username: 'u' };
    const storage = memoryStorage({ [LEGACY_CREDS_STORAGE_KEY]: legacy });
    const { secrets } = memorySecrets();

    const result = await migrateCredentials(storage, secrets);

    expect(result).toEqual({ failed: 0, migrated: 0 });
    expect(storage.read(LEGACY_CREDS_STORAGE_KEY)).toEqual(legacy);
  });

  test('ignores unreadable storage', async () => {
    const storage = memoryStorage({});
    storage.setItem(ENTITIES_STORAGE_KEY, '{not json');
    const { secrets } = memorySecrets();

    await expect(migrateCredentials(storage, secrets)).resolves.toEqual({ failed: 0, migrated: 0 });
    expect(storage.getItem(ENTITIES_STORAGE_KEY)).toBe('{not json');
  });
});

describe('createPasswordVault', () => {
  test('applies writes for one entity in call order', async () => {
    const items = new Map<string, string>();
    // Each later call resolves faster, so unordered writes would end on the first value.
    let delay = 30;
    const secrets: SecretStore = {
      delete: async (key) => {
        items.delete(key);
      },
      get: async (key) => items.get(key) ?? null,
      set: (key, value) => {
        const ms = delay;
        delay -= 10;
        return new Promise((resolve) => {
          setTimeout(() => {
            items.set(key, value);
            resolve();
          }, ms);
        });
      },
    };
    const vault = createPasswordVault(secrets);

    void vault.set('a', 'p');
    void vault.set('a', 'pa');
    void vault.set('a', 'pas');

    expect(await vault.get('a')).toBe('pas');
  });

  test('an empty password deletes the item and a failed write does not block the next', async () => {
    const { items, secrets } = memorySecrets({ failOn: [passwordKey('b')] });
    const vault = createPasswordVault(secrets);

    await vault.set('a', 'secret');
    await vault.set('a', '');
    await expect(vault.set('b', 'secret')).rejects.toThrow('keychain unavailable');
    await vault.delete('b');

    expect(items.has(passwordKey('a'))).toBe(false);
    expect(await vault.get('b')).toBeNull();
  });
});
