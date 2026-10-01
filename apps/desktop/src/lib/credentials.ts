// GİB passwords live in the OS keychain under `gib-password:<entityId>`. This
// module has no Tauri imports so tests can inject storage and keychain fakes.

export const ENTITIES_STORAGE_KEY = 'fatura-entities';
export const LEGACY_CREDS_STORAGE_KEY = 'fatura-creds';

export const passwordKey = (entityId: string) => `gib-password:${entityId}`;

export interface SecretStore {
  delete: (key: string) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
}

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface MigrationResult {
  /** The keychain error of the last failed write */
  error?: unknown;
  failed: number;
  migrated: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readJSON(storage: KeyValueStorage, key: string): unknown {
  try {
    return JSON.parse(storage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

/**
 * Moves plaintext passwords from localStorage into the keychain. A password is
 * removed from localStorage only after its keychain write succeeds, so a failed
 * run keeps the plaintext and the next run retries it.
 */
export async function migrateCredentials(
  storage: KeyValueStorage,
  secrets: Pick<SecretStore, 'set'>,
): Promise<MigrationResult> {
  const result: MigrationResult = { failed: 0, migrated: 0 };
  const entities = readJSON(storage, ENTITIES_STORAGE_KEY);
  const hasEntities = Array.isArray(entities) && entities.length > 0;

  if (hasEntities) {
    let changed = false;
    for (const entity of entities) {
      if (
        !isRecord(entity) ||
        typeof entity.id !== 'string' ||
        !entity.id ||
        !isRecord(entity.creds) ||
        !('password' in entity.creds)
      ) {
        continue;
      }
      const { password } = entity.creds;
      if (typeof password === 'string' && password !== '') {
        try {
          await secrets.set(passwordKey(entity.id), password);
        } catch (error) {
          result.error = error;
          result.failed++;
          continue;
        }
        result.migrated++;
      }
      delete entity.creds.password;
      changed = true;
    }
    if (changed) {
      storage.setItem(ENTITIES_STORAGE_KEY, JSON.stringify(entities));
    }
  }

  // The legacy single-entity creds were copied into the first entity when
  // entities were introduced, so once entities exist this password is a stale
  // duplicate. Without entities it is the only copy and stays put.
  const legacy = readJSON(storage, LEGACY_CREDS_STORAGE_KEY);
  if (hasEntities && isRecord(legacy) && 'password' in legacy) {
    delete legacy.password;
    storage.setItem(LEGACY_CREDS_STORAGE_KEY, JSON.stringify(legacy));
  }

  return result;
}

/**
 * Keychain access per entity. Calls for the same entity run in call order, so
 * saving on every keystroke cannot finish with an older value, and a read waits
 * for pending writes. An empty password deletes the item.
 */
export function createPasswordVault(secrets: SecretStore) {
  const queues = new Map<string, Promise<unknown>>();

  const run = <T>(entityId: string, task: () => Promise<T>): Promise<T> => {
    const next = (queues.get(entityId) ?? Promise.resolve()).then(task, task);
    queues.set(entityId, next);
    return next;
  };

  return {
    delete: (entityId: string) => run(entityId, () => secrets.delete(passwordKey(entityId))),
    get: (entityId: string) => run(entityId, () => secrets.get(passwordKey(entityId))),
    set: (entityId: string, password: string) =>
      run(entityId, () =>
        password
          ? secrets.set(passwordKey(entityId), password)
          : secrets.delete(passwordKey(entityId)),
      ),
  };
}
