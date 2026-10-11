import { afterEach, describe, expect, test, vi } from 'vitest';
import { ENTITIES_STORAGE_KEY } from '../src/lib/credentials.ts';
import { KEYCHAIN_ACCESS_HINT, keychainErrorMessage } from '../src/lib/keychain-error.ts';
import type { StoredLicense } from '../src/lib/license.ts';
import {
  createVault,
  LEGACY_LICENSE_SECRET_KEY,
  LEGACY_LICENSE_STORAGE_KEY,
  LICENSE_SECRET_KEY,
  parseVault,
  PASSWORD_SAVE_DELAY_MS,
  passwordKey,
  readLegacyItems,
  type LegacySecrets,
} from '../src/lib/vault.ts';

const DENIED = 'PlatformFailure: Platform secure storage failure: User interaction is not allowed.';

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

function memoryBackend(stored: string | null = null) {
  const state = { failRead: false, failWrite: false, reads: 0, stored };
  const writes: Array<string> = [];
  return {
    backend: {
      read: async () => {
        state.reads++;
        if (state.failRead) {
          throw new Error(DENIED);
        }
        return state.stored;
      },
      write: async (json: string) => {
        if (state.failWrite) {
          throw new Error('keychain unavailable');
        }
        writes.push(json);
        state.stored = json;
      },
    },
    state,
    writes,
  };
}

function memorySecrets(initial: Record<string, string> = {}, { failDelete = false } = {}) {
  const items = new Map(Object.entries(initial));
  const gets: Array<string> = [];
  const secrets: LegacySecrets = {
    delete: async (key) => {
      if (failDelete) {
        throw new Error(DENIED);
      }
      items.delete(key);
    },
    get: async (key) => {
      gets.push(key);
      return items.get(key) ?? null;
    },
  };
  return { gets, items, secrets };
}

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

const entities = (...ids: Array<string>) =>
  JSON.stringify(ids.map((id) => ({ creds: { username: id }, id })));

const stored = (data: object) => JSON.stringify({ gibPasswords: {}, v: 1, ...data });

/** A vault over a backend that already holds `data`, with no old items. */
function vaultOver(data: object | null) {
  const memory = memoryBackend(data === null ? null : stored(data));
  const vault = createVault({
    backend: memory.backend,
    migrate: () => readLegacyItems(memorySecrets().secrets, memoryStorage()),
  });
  return { ...memory, vault };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('cache', () => {
  test('reads the backend once per launch and serves every read from memory', async () => {
    const { state, vault } = vaultOver({ gibPasswords: { a: 'secret-a' }, license });

    await Promise.all([vault.getPassword('a'), vault.getLicense(), vault.load()]);
    expect(await vault.getPassword('a')).toBe('secret-a');
    expect(await vault.getPassword('b')).toBeNull();
    expect(await vault.getLicense()).toEqual(license);
    expect(vault.hasPassword('a')).toBe(true);
    expect(vault.hasPassword('b')).toBe(false);

    expect(state.reads).toBe(1);
  });

  test('hasPassword is false until the vault is loaded', async () => {
    const { vault } = vaultOver({ gibPasswords: { a: 'secret-a' } });
    expect(vault.hasPassword('a')).toBe(false);
    await vault.load();
    expect(vault.hasPassword('a')).toBe(true);
  });

  test('a failed read rejects with the backend error and the next call reads again', async () => {
    const { state, vault } = vaultOver({ gibPasswords: { a: 'secret-a' } });
    state.failRead = true;

    const error = await vault.getPassword('a').catch((error: unknown) => error);
    expect(keychainErrorMessage('Okunamadı.', error)).toBe(`Okunamadı. ${KEYCHAIN_ACCESS_HINT}`);

    state.failRead = false;
    expect(await vault.getPassword('a')).toBe('secret-a');
    expect(state.reads).toBe(2);
  });

  test('writes nothing when the content does not change', async () => {
    vi.useFakeTimers();
    // Stored with its keys in another order than the vault writes them.
    const text = JSON.stringify({
      gibPasswords: Object.fromEntries([
        ['b', 'secret-b'],
        ['a', 'secret-a'],
      ]),
      license: { ...legacyRecord, key: license.key, lastSeenAt: license.lastSeenAt },
      v: 1,
    });
    const { backend, writes } = memoryBackend(text);
    const vault = createVault({
      backend,
      migrate: () => readLegacyItems(memorySecrets().secrets, memoryStorage()),
    });

    const typed = vault.setPassword('a', 'secret-a');
    await vi.advanceTimersByTimeAsync(PASSWORD_SAVE_DELAY_MS);
    await typed;
    await vault.setLicense({ ...license }, { save: true });
    await vault.savePasswords({ b: 'secret-b' });

    expect(writes).toEqual([]);
  });

  test('a password change waits for typing to pause, then writes once', async () => {
    vi.useFakeTimers();
    const { vault, writes } = vaultOver({});

    const typed = [vault.setPassword('a', 'p'), vault.setPassword('a', 'pa')];
    await vi.advanceTimersByTimeAsync(PASSWORD_SAVE_DELAY_MS - 1);
    typed.push(vault.setPassword('a', 'pas'));
    await vi.advanceTimersByTimeAsync(PASSWORD_SAVE_DELAY_MS - 1);

    expect(writes).toEqual([]);
    expect(await vault.getPassword('a')).toBe('pas');
    expect(vault.hasPassword('a')).toBe(true);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.all(typed);
    expect(writes).toHaveLength(1);
    expect(parseVault(writes[0]).gibPasswords).toEqual({ a: 'pas' });
  });

  test('flush writes a pending change at once and does nothing without one', async () => {
    vi.useFakeTimers();
    const { vault, writes } = vaultOver({});

    await vault.flush();
    expect(writes).toEqual([]);

    const typed = vault.setPassword('a', 'secret');
    await vault.load();
    await vault.flush();
    await typed;
    expect(writes).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(PASSWORD_SAVE_DELAY_MS);
    expect(writes).toHaveLength(1);
  });

  test('a failed write rejects the change, never the flush, and the next write retries', async () => {
    const { state, vault, writes } = vaultOver({});
    await vault.load();
    state.failWrite = true;

    const typed = vault.setPassword('a', 'secret');
    const failure = expect(typed).rejects.toThrow('keychain unavailable');
    await vault.load();
    await expect(vault.flush()).resolves.toBeUndefined();
    await failure;
    expect(await vault.getPassword('a')).toBe('secret');

    state.failWrite = false;
    await vault.savePasswords({ b: 'secret-b' });
    expect(parseVault(writes[0]).gibPasswords).toEqual({ a: 'secret', b: 'secret-b' });
  });

  test('deleting a password writes at once', async () => {
    const { vault, writes } = vaultOver({ gibPasswords: { a: 'secret-a', b: 'secret-b' } });

    await vault.deletePassword('a');

    expect(writes).toHaveLength(1);
    expect(parseVault(writes[0]).gibPasswords).toEqual({ b: 'secret-b' });
    expect(vault.hasPassword('a')).toBe(false);
  });

  test('a license kept in memory goes out with the next write', async () => {
    const { vault, writes } = vaultOver({ license });
    const seen = { ...license, lastSeenAt: '2026-10-02T10:00:00.000Z' };

    await vault.setLicense(seen, { save: false });
    expect(writes).toEqual([]);
    expect(await vault.getLicense()).toEqual(seen);
    expect(vault.savedLicense()).toEqual(license);

    await vault.savePasswords({ a: 'secret-a' });
    expect(parseVault(writes[0]).license).toEqual(seen);
    expect(vault.savedLicense()).toEqual(seen);
  });

  test('a failed license write puts the previous license back', async () => {
    const { state, vault } = vaultOver({ license });
    await vault.load();
    state.failWrite = true;

    await expect(vault.setLicense(null, { save: true })).rejects.toThrow('keychain unavailable');
    expect(await vault.getLicense()).toEqual(license);
  });
});

describe('migration from the old items', () => {
  test('fills the vault once from the password and license items, then removes them', async () => {
    const storage = memoryStorage({ [ENTITIES_STORAGE_KEY]: entities('a', 'b') });
    const { gets, items, secrets } = memorySecrets({
      [LICENSE_SECRET_KEY]: JSON.stringify(license),
      [passwordKey('a')]: 'secret-a',
      [passwordKey('gone')]: 'not a stored company',
    });
    const memory = memoryBackend();
    const migrate = () => readLegacyItems(secrets, storage);

    const vault = createVault({ backend: memory.backend, migrate });
    expect(await vault.getPassword('a')).toBe('secret-a');
    expect(await vault.getLicense()).toEqual(license);
    expect(memory.writes).toHaveLength(1);
    expect(parseVault(memory.writes[0])).toEqual({
      gibPasswords: { a: 'secret-a' },
      license,
      v: 1,
    });
    expect([...items.keys()]).toEqual([passwordKey('gone')]);

    // The next launch reads the vault alone.
    gets.length = 0;
    const next = createVault({ backend: memory.backend, migrate });
    expect(await next.getPassword('a')).toBe('secret-a');
    expect(gets).toEqual([]);
    expect(memory.writes).toHaveLength(1);
  });

  test('keeps the old items when the vault write fails, and retries on the next load', async () => {
    const storage = memoryStorage({ [ENTITIES_STORAGE_KEY]: entities('a') });
    const { items, secrets } = memorySecrets({
      [LICENSE_SECRET_KEY]: JSON.stringify(license),
      [passwordKey('a')]: 'secret-a',
    });
    const memory = memoryBackend();
    memory.state.failWrite = true;
    const vault = createVault({
      backend: memory.backend,
      migrate: () => readLegacyItems(secrets, storage),
    });

    await expect(vault.load()).rejects.toThrow('keychain unavailable');
    expect(items.size).toBe(2);

    memory.state.failWrite = false;
    expect(await vault.getPassword('a')).toBe('secret-a');
    expect(items.size).toBe(0);
  });

  test('a failed read of an old item writes no vault', async () => {
    const storage = memoryStorage({ [ENTITIES_STORAGE_KEY]: entities('a') });
    const memory = memoryBackend();
    const vault = createVault({
      backend: memory.backend,
      migrate: () =>
        readLegacyItems(
          {
            delete: async () => {},
            get: async () => {
              throw new Error(DENIED);
            },
          },
          storage,
        ),
    });

    await expect(vault.load()).rejects.toThrow(DENIED);
    expect(memory.writes).toEqual([]);
  });

  test('a first launch writes an empty vault, so later launches read no old items', async () => {
    const { gets, secrets } = memorySecrets();
    const memory = memoryBackend();
    const vault = createVault({
      backend: memory.backend,
      migrate: () => readLegacyItems(secrets, memoryStorage()),
    });

    await vault.load();

    expect(gets).toEqual([LICENSE_SECRET_KEY]);
    expect(memory.writes).toEqual(['{"v":1,"gibPasswords":{}}']);
  });

  test('an old item that cannot be removed stays behind and the vault still loads', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { items, secrets } = memorySecrets(
      { [LICENSE_SECRET_KEY]: JSON.stringify(license) },
      { failDelete: true },
    );
    const vault = createVault({
      backend: memoryBackend().backend,
      migrate: () => readLegacyItems(secrets, memoryStorage()),
    });

    expect(await vault.getLicense()).toEqual(license);
    expect(items.has(LICENSE_SECRET_KEY)).toBe(true);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  test('moves the localStorage license record and the keychain key into the vault', async () => {
    const storage = memoryStorage({ [LEGACY_LICENSE_STORAGE_KEY]: JSON.stringify(legacyRecord) });
    const { items, secrets } = memorySecrets({ [LEGACY_LICENSE_SECRET_KEY]: 'ANGARIA-KEY' });
    const { cleanup, data } = await readLegacyItems(secrets, storage);

    expect(data.license).toEqual({ ...license, lastSeenAt: license.lastValidatedAt });
    expect(items.size).toBe(1);
    await cleanup();
    expect(items.size).toBe(0);
    expect(storage.data.size).toBe(0);
  });

  test('drops a legacy record without its key, and an unreadable one with its key', async () => {
    const withoutKey = memoryStorage({
      [LEGACY_LICENSE_STORAGE_KEY]: JSON.stringify(legacyRecord),
    });
    const first = await readLegacyItems(memorySecrets().secrets, withoutKey);
    expect(first.data.license).toBeUndefined();
    await first.cleanup();
    expect(withoutKey.data.size).toBe(0);

    const unreadable = memoryStorage({ [LEGACY_LICENSE_STORAGE_KEY]: '{not json' });
    const { items, secrets } = memorySecrets({ [LEGACY_LICENSE_SECRET_KEY]: 'ANGARIA-KEY' });
    const second = await readLegacyItems(secrets, unreadable);
    expect(second.data.license).toBeUndefined();
    await second.cleanup();
    expect(items.size).toBe(0);
    expect(unreadable.data.size).toBe(0);
  });

  test('ignores the legacy copies once the license item exists', async () => {
    const storage = memoryStorage({ [LEGACY_LICENSE_STORAGE_KEY]: JSON.stringify(legacyRecord) });
    const { items, secrets } = memorySecrets({
      [LEGACY_LICENSE_SECRET_KEY]: 'OLD-KEY',
      [LICENSE_SECRET_KEY]: JSON.stringify(license),
    });

    const { cleanup, data } = await readLegacyItems(secrets, storage);
    await cleanup();

    expect(data.license).toEqual(license);
    expect(items.get(LEGACY_LICENSE_SECRET_KEY)).toBe('OLD-KEY');
    expect(storage.data.has(LEGACY_LICENSE_STORAGE_KEY)).toBe(true);
  });

  test('reads an unreadable license item as no license', async () => {
    const { secrets } = memorySecrets({ [LICENSE_SECRET_KEY]: '{not json' });
    expect((await readLegacyItems(secrets, memoryStorage())).data.license).toBeUndefined();
  });
});

describe('parseVault', () => {
  test('reads unreadable parts as missing', () => {
    expect(parseVault('{not json')).toEqual({ gibPasswords: {}, v: 1 });
    expect(
      parseVault(
        JSON.stringify({ gibPasswords: { a: 'x', b: '', c: 5 }, license: { key: 'K' }, v: 1 }),
      ),
    ).toEqual({ gibPasswords: { a: 'x' }, v: 1 });
  });
});

describe('GİB sessions', () => {
  const session = { baseUrl: 'https://earsivportal.efatura.gov.tr', cookies: ['a=1'], token: 'T' };

  test('are kept until forgotten, written only when they change', async () => {
    const { state, vault, writes } = vaultOver({ gibPasswords: { a: 'x' } });

    await vault.saveSession('33333301', session);
    await vault.saveSession('33333301', { ...session });
    expect(writes).toHaveLength(1);
    expect(await vault.getSessions()).toEqual({ '33333301': session });
    expect(parseVault(state.stored ?? '').gibPasswords).toEqual({ a: 'x' });

    await vault.saveSession('33333301', null);
    await vault.saveSession('33333301', null);
    expect(writes).toHaveLength(2);
    expect(JSON.parse(writes[1] ?? '')).toEqual({ gibPasswords: { a: 'x' }, v: 1 });
  });

  test('a copy is kept: the live session’s cookies change on every call', async () => {
    const { vault } = vaultOver({});
    const live = { ...session, cookies: [...session.cookies] };
    await vault.saveSession('u', live);
    live.cookies = ['a=2'];
    expect((await vault.getSessions()).u?.cookies).toEqual(['a=1']);
  });

  test('unreadable sessions read as missing', () => {
    expect(
      parseVault(
        JSON.stringify({
          gibPasswords: {},
          gibSessions: { a: session, b: { token: '' }, c: 'x' },
          v: 1,
        }),
      ).gibSessions,
    ).toEqual({ a: session });
  });
});
