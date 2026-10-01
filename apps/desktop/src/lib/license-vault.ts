// The license record (key, activation, check times) lives in one keychain item
// as JSON. This module has no Tauri imports so tests can inject fakes.
import type { SecretStore } from './credentials.ts';
import { parseStoredLicense, type StoredLicense } from './license.ts';

export const LICENSE_SECRET_KEY = 'license';
// Dev builds before the single item kept the key alone in the keychain and the
// rest of the record in localStorage.
export const LEGACY_LICENSE_SECRET_KEY = 'license-key';
export const LEGACY_LICENSE_STORAGE_KEY = 'angaria-license';

export type LegacyLicenseStorage = Pick<Storage, 'getItem' | 'removeItem'>;

function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const saveLicense = (secrets: Pick<SecretStore, 'set'>, license: StoredLicense) =>
  secrets.set(LICENSE_SECRET_KEY, JSON.stringify(license));

export const clearLicense = (secrets: Pick<SecretStore, 'delete'>) =>
  secrets.delete(LICENSE_SECRET_KEY);

/**
 * Moves a legacy record into the keychain item. The legacy copies are removed
 * only after the write succeeds, so a failed run retries on the next load.
 */
async function migrateLegacyLicense(
  secrets: SecretStore,
  storage: LegacyLicenseStorage,
): Promise<StoredLicense | null> {
  const legacy = storage.getItem(LEGACY_LICENSE_STORAGE_KEY);
  if (legacy === null) {
    return null;
  }
  const key = await secrets.get(LEGACY_LICENSE_SECRET_KEY);
  const record = parseJSON(legacy);
  const license =
    key && typeof record === 'object' && record !== null && 'lastValidatedAt' in record
      ? parseStoredLicense({ ...record, key, lastSeenAt: record.lastValidatedAt })
      : null;
  if (license) {
    await saveLicense(secrets, license);
  }
  await secrets.delete(LEGACY_LICENSE_SECRET_KEY);
  storage.removeItem(LEGACY_LICENSE_STORAGE_KEY);
  return license;
}

/** The stored license, or null when there is none or it is unreadable. */
export async function loadLicense(
  secrets: SecretStore,
  storage: LegacyLicenseStorage,
): Promise<StoredLicense | null> {
  const stored = await secrets.get(LICENSE_SECRET_KEY);
  return stored === null
    ? migrateLegacyLicense(secrets, storage)
    : parseStoredLicense(parseJSON(stored));
}
