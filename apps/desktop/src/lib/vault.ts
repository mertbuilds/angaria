// Every secret (the license record and the trial, each company's GİB password
// and the GİB sessions open right now) lives in one keychain item as JSON, read once per
// launch and served from memory. Dev builds keep it in a file instead
// (src-tauri/src/secrets.rs). This module has no Tauri imports so tests can
// inject the backend and the legacy items.
import type { SessionInfo } from 'angaria-earsiv-sdk';
import { ENTITIES_STORAGE_KEY } from './credentials.ts';
import { reportKeychainError } from './keychain-error.ts';
import {
  parseStoredLicense,
  parseStoredTrial,
  type StoredLicense,
  type StoredTrial,
} from './license.ts';

export interface VaultData {
  /** Passwords by entity id */
  gibPasswords: Record<string, string>;
  /**
   * The GİB sessions open now, by user code, until their logout: a launch
   * after a crash logs them out (src/lib/session-queue.ts).
   */
  gibSessions?: Record<string, SessionInfo>;
  license?: StoredLicense;
  trial?: StoredTrial;
  v: 1;
}

export interface VaultBackend {
  read: () => Promise<string | null>;
  write: (json: string) => Promise<void>;
}

/** What the vault starts from when the backend has none yet. */
export interface VaultMigration {
  /** Removes the old copies. Runs only after the vault is written. */
  cleanup: () => Promise<void>;
  data: VaultData;
}

/** A password change waits this long for the next keystroke before it is written. */
export const PASSWORD_SAVE_DELAY_MS = 500;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const emptyVault = (): VaultData => ({ gibPasswords: {}, v: 1 });

function setLicenseIn(data: VaultData, license: StoredLicense | null) {
  if (license) {
    data.license = license;
  } else {
    delete data.license;
  }
}

function setPasswordIn(data: VaultData, entityId: string, password: string) {
  if (password) {
    data.gibPasswords[entityId] = password;
  } else {
    delete data.gibPasswords[entityId];
  }
}

function parseSession(value: unknown): SessionInfo | null {
  if (
    !isRecord(value) ||
    typeof value.token !== 'string' ||
    !value.token ||
    typeof value.baseUrl !== 'string' ||
    !Array.isArray(value.cookies)
  ) {
    return null;
  }
  return {
    baseUrl: value.baseUrl,
    cookies: value.cookies.filter((cookie): cookie is string => typeof cookie === 'string'),
    token: value.token,
  };
}

function setSessionIn(data: VaultData, userCode: string, session: SessionInfo | null) {
  const sessions = { ...data.gibSessions };
  // A copy: the SDK updates a live session's cookies on every call.
  const copy = parseSession(session);
  if (copy) {
    sessions[userCode] = copy;
  } else {
    delete sessions[userCode];
  }
  if (Object.keys(sessions).length > 0) {
    data.gibSessions = sessions;
  } else {
    delete data.gibSessions;
  }
}

/** The vault in a stored text. Unreadable parts read as missing. */
export function parseVault(text: string): VaultData {
  const value = parseJSON(text);
  const vault = emptyVault();
  if (!isRecord(value)) {
    return vault;
  }
  if (isRecord(value.gibPasswords)) {
    for (const [entityId, password] of Object.entries(value.gibPasswords)) {
      if (typeof password === 'string' && password !== '') {
        vault.gibPasswords[entityId] = password;
      }
    }
  }
  if (isRecord(value.gibSessions)) {
    for (const [userCode, stored] of Object.entries(value.gibSessions)) {
      setSessionIn(vault, userCode, parseSession(stored));
    }
  }
  setLicenseIn(vault, parseStoredLicense(value.license));
  const trial = parseStoredTrial(value.trial);
  if (trial) {
    vault.trial = trial;
  }
  return vault;
}

/** One text per content: keys in a fixed order, so equal vaults compare equal. */
function serializeVault({ gibPasswords, gibSessions, license, trial }: VaultData): string {
  const passwords = Object.fromEntries(
    Object.keys(gibPasswords)
      .toSorted()
      .map((entityId) => [entityId, gibPasswords[entityId]]),
  );
  return JSON.stringify({
    v: 1,
    // parseStoredLicense lists the fields in a fixed order.
    ...(license && { license: parseStoredLicense(license) }),
    ...(trial && { trial: { startedAt: trial.startedAt } }),
    gibPasswords: passwords,
    ...(gibSessions && {
      gibSessions: Object.fromEntries(
        Object.keys(gibSessions)
          .toSorted()
          .map((userCode) => {
            const { baseUrl, cookies, token } = gibSessions[userCode];
            return [userCode, { baseUrl, cookies, token }];
          }),
      ),
    }),
  });
}

const noop = () => {};

interface Deferred {
  promise: Promise<void>;
  reject: (error: unknown) => void;
  resolve: () => void;
}

function deferred(): Deferred {
  let resolve = noop;
  let reject: (error: unknown) => void = noop;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

export interface Vault {
  /** Removes an entity's password and writes at once. */
  deletePassword: (entityId: string) => Promise<void>;
  /**
   * Writes a pending password change now (blur, leaving Ayarlar, closing the
   * window). Never rejects: the change's own promise reports a failure.
   */
  flush: () => Promise<void>;
  getLicense: () => Promise<StoredLicense | null>;
  getPassword: (entityId: string) => Promise<string | null>;
  getSessions: () => Promise<Record<string, SessionInfo>>;
  getTrial: () => Promise<StoredTrial | null>;
  /** From memory: false until the vault is loaded. */
  hasPassword: (entityId: string) => boolean;
  /**
   * Reads the backend the first time it is called and shares that read with
   * every later call. A failed read rejects and the next call tries again.
   */
  load: () => Promise<void>;
  /** The license as last written or read, to decide whether a change is worth a write. */
  savedLicense: () => StoredLicense | null;
  /** Sets several passwords and writes at once. */
  savePasswords: (passwords: Record<string, string>) => Promise<void>;
  /** Keeps a GİB user's open session (null forgets it) and writes at once when that changes it. */
  saveSession: (userCode: string, session: SessionInfo | null) => Promise<void>;
  /** Keeps the trial and writes at once. */
  saveTrial: (trial: StoredTrial) => Promise<void>;
  /**
   * Replaces the license in memory, and writes it when `save` is set. A failed
   * write puts the previous license back and rejects.
   */
  setLicense: (license: StoredLicense | null, options: { save: boolean }) => Promise<void>;
  /**
   * Sets a password in memory at once ('' removes it) and writes it after
   * PASSWORD_SAVE_DELAY_MS without another change. Resolves once written.
   */
  setPassword: (entityId: string, password: string) => Promise<void>;
}

export function createVault({
  backend,
  migrate,
  saveDelayMs = PASSWORD_SAVE_DELAY_MS,
}: {
  backend: VaultBackend;
  /** Builds the first vault from the items it replaces. */
  migrate: () => Promise<VaultMigration>;
  saveDelayMs?: number;
}): Vault {
  let data = emptyVault();
  let loading: Promise<void> | null = null;
  // The backend's content, serialized; null until the first read.
  let persisted: string | null = null;
  // Writes run one at a time, each with the content at its turn. Never rejects.
  let writes: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let scheduled: Deferred | null = null;

  async function read() {
    const stored = await backend.read();
    if (stored !== null) {
      data = parseVault(stored);
      persisted = serializeVault(data);
      return;
    }
    const { cleanup, data: migrated } = await migrate();
    const json = serializeVault(migrated);
    await backend.write(json);
    data = migrated;
    persisted = json;
    await cleanup();
  }

  const load = () => {
    loading ??= read().catch((error: unknown) => {
      loading = null;
      throw error;
    });
    return loading;
  };

  function write(): Promise<void> {
    const result = writes.then(async () => {
      const json = serializeVault(data);
      if (json !== persisted) {
        await backend.write(json);
        persisted = json;
      }
    });
    writes = result.catch(noop);
    return result;
  }

  /** Writes now; a scheduled write settles with this one. */
  function save(): Promise<void> {
    clearTimeout(timer);
    const waiting = scheduled;
    scheduled = null;
    const result = write();
    if (waiting) {
      result.then(waiting.resolve, waiting.reject);
    }
    return result;
  }

  function schedule(): Promise<void> {
    clearTimeout(timer);
    scheduled ??= deferred();
    // The scheduled promise carries a failure to the callers.
    timer = setTimeout(() => save().catch(noop), saveDelayMs);
    return scheduled.promise;
  }

  return {
    deletePassword: async (entityId) => {
      await load();
      setPasswordIn(data, entityId, '');
      return save();
    },
    flush: () => (scheduled ? save() : writes).then(noop, noop),
    getLicense: async () => {
      await load();
      return data.license ?? null;
    },
    getPassword: async (entityId) => {
      await load();
      return data.gibPasswords[entityId] ?? null;
    },
    getSessions: async () => {
      await load();
      return { ...data.gibSessions };
    },
    getTrial: async () => {
      await load();
      return data.trial ?? null;
    },
    hasPassword: (entityId) => Boolean(data.gibPasswords[entityId]),
    load,
    saveSession: async (userCode, session) => {
      await load();
      setSessionIn(data, userCode, session);
      return save();
    },
    saveTrial: async (trial) => {
      await load();
      data.trial = trial;
      return save();
    },
    savedLicense: () => (persisted === null ? null : (parseVault(persisted).license ?? null)),
    savePasswords: async (passwords) => {
      await load();
      for (const [entityId, password] of Object.entries(passwords)) {
        setPasswordIn(data, entityId, password);
      }
      return save();
    },
    setLicense: async (license, { save: now }) => {
      await load();
      const previous = data.license ?? null;
      setLicenseIn(data, license);
      if (!now) {
        return;
      }
      try {
        await save();
      } catch (error) {
        if ((data.license ?? null) === license) {
          setLicenseIn(data, previous);
        }
        throw error;
      }
    },
    setPassword: async (entityId, password) => {
      await load();
      setPasswordIn(data, entityId, password);
      return schedule();
    },
  };
}

// The keychain items before the vault.
/** The license record as one JSON item */
export const LICENSE_SECRET_KEY = 'license';
// Dev builds before that kept the key alone in the keychain and the rest of
// the record in localStorage.
export const LEGACY_LICENSE_SECRET_KEY = 'license-key';
export const LEGACY_LICENSE_STORAGE_KEY = 'angaria-license';
/** One item per company */
export const passwordKey = (entityId: string) => `gib-password:${entityId}`;

export interface LegacySecrets {
  delete: (key: string) => Promise<void>;
  get: (key: string) => Promise<string | null>;
}

export type LegacyStorage = Pick<Storage, 'getItem' | 'removeItem'>;

function storedEntityIds(storage: LegacyStorage): Array<string> {
  const entities = parseJSON(storage.getItem(ENTITIES_STORAGE_KEY) ?? 'null');
  return Array.isArray(entities)
    ? entities.flatMap((entity) =>
        isRecord(entity) && typeof entity.id === 'string' && entity.id ? [entity.id] : [],
      )
    : [];
}

/**
 * Reads the keychain items the vault replaces: a password item per stored
 * company, the license item, or before it the legacy license key with its
 * localStorage record. The cleanup removes them; run it only once the vault
 * holds what they had, so a failed write keeps them for the next launch.
 */
export async function readLegacyItems(
  secrets: LegacySecrets,
  storage: LegacyStorage,
): Promise<VaultMigration> {
  const data = emptyVault();
  const oldKeys: Array<string> = [];
  const oldStorageKeys: Array<string> = [];

  for (const entityId of storedEntityIds(storage)) {
    const password = await secrets.get(passwordKey(entityId));
    if (password !== null) {
      oldKeys.push(passwordKey(entityId));
      setPasswordIn(data, entityId, password);
    }
  }

  const stored = await secrets.get(LICENSE_SECRET_KEY);
  if (stored !== null) {
    oldKeys.push(LICENSE_SECRET_KEY);
    setLicenseIn(data, parseStoredLicense(parseJSON(stored)));
  } else {
    const legacy = storage.getItem(LEGACY_LICENSE_STORAGE_KEY);
    if (legacy !== null) {
      const key = await secrets.get(LEGACY_LICENSE_SECRET_KEY);
      const record = parseJSON(legacy);
      const license =
        key && isRecord(record) && 'lastValidatedAt' in record
          ? parseStoredLicense({ ...record, key, lastSeenAt: record.lastValidatedAt })
          : null;
      setLicenseIn(data, license);
      oldKeys.push(LEGACY_LICENSE_SECRET_KEY);
      oldStorageKeys.push(LEGACY_LICENSE_STORAGE_KEY);
    }
  }

  return {
    cleanup: async () => {
      for (const key of oldKeys) {
        // A copy left behind is harmless: the vault is read first from now on.
        await secrets
          .delete(key)
          .catch((error: unknown) =>
            reportKeychainError('Eski anahtar zinciri kaydı silinemedi.', error),
          );
      }
      for (const key of oldStorageKeys) {
        storage.removeItem(key);
      }
    },
    data,
  };
}
