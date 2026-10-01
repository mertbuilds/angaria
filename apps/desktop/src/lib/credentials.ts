// GİB passwords live in the vault (vault.ts), keyed by entity id. This module
// has no Tauri imports so tests can inject storage and vault fakes.

export const ENTITIES_STORAGE_KEY = 'fatura-entities';
export const LEGACY_CREDS_STORAGE_KEY = 'fatura-creds';

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface MigrationResult {
  /** The vault error of a failed write */
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
 * Moves plaintext passwords from localStorage into the vault in one write. The
 * passwords are removed from localStorage only after that write succeeds, so a
 * failed run keeps the plaintext and the next run retries it.
 */
export async function migrateCredentials(
  storage: KeyValueStorage,
  vault: { savePasswords: (passwords: Record<string, string>) => Promise<void> },
): Promise<MigrationResult> {
  const result: MigrationResult = { failed: 0, migrated: 0 };
  const entities = readJSON(storage, ENTITIES_STORAGE_KEY);
  const hasEntities = Array.isArray(entities) && entities.length > 0;

  if (hasEntities) {
    const withPassword = entities.flatMap((entity) =>
      isRecord(entity) &&
      typeof entity.id === 'string' &&
      entity.id &&
      isRecord(entity.creds) &&
      'password' in entity.creds
        ? [{ creds: entity.creds, id: entity.id }]
        : [],
    );
    const passwords: Record<string, string> = {};
    for (const { creds, id } of withPassword) {
      if (typeof creds.password === 'string' && creds.password !== '') {
        passwords[id] = creds.password;
      }
    }
    const count = Object.keys(passwords).length;
    let saved = true;
    if (count > 0) {
      try {
        await vault.savePasswords(passwords);
        result.migrated = count;
      } catch (error) {
        result.error = error;
        result.failed = count;
        saved = false;
      }
    }
    let changed = false;
    for (const { creds, id } of withPassword) {
      if (saved || !Object.hasOwn(passwords, id)) {
        delete creds.password;
        changed = true;
      }
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
