const DAY_MS = 24 * 60 * 60 * 1000;

export const GRACE_PERIOD_MS = 7 * DAY_MS;

export interface LicenseDetails {
  customerEmail: string | null;
  displayKey: string;
  expiresAt: string | null;
}

// The whole record lives in one keychain item (license-vault.ts).
export interface StoredLicense extends LicenseDetails {
  activationId: string;
  key: string;
  /** The latest time the app has seen. A clock behind it was set back. */
  lastSeenAt: string;
  lastValidatedAt: string;
}

export type LicenseStatus =
  | { kind: 'unlicensed' }
  | { kind: 'valid' }
  | { daysLeft: number; kind: 'grace' }
  | { kind: 'expired'; reason: 'offline' | 'subscription' }
  | { kind: 'invalid' };

// inactive: Polar knows the key but it is revoked, disabled or past expires_at.
// invalid: unknown key, or this device's activation was removed.
export type ValidationOutcome =
  | { details: LicenseDetails; kind: 'valid' }
  | { kind: 'inactive' }
  | { kind: 'invalid' }
  | { kind: 'offline' };

export type LicenseErrorCode = 'inactive' | 'invalid' | 'limit-reached' | 'offline' | 'rejected';

const errorMessages: Record<LicenseErrorCode, string> = {
  inactive: 'Bu lisans artık geçerli değil. Aboneliğinizi kontrol edin.',
  invalid: 'Lisans anahtarı geçerli değil. Anahtarı kontrol edip tekrar deneyin.',
  'limit-reached':
    'Bu lisans izin verilen tüm cihazlarda etkin. Polar müşteri portalından bir cihazı kaldırıp tekrar deneyin.',
  offline: "Polar'a bağlanılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
  rejected: 'Lisans işlemi tamamlanamadı. Biraz sonra tekrar deneyin.',
};

export class LicenseError extends Error {
  readonly code: LicenseErrorCode;

  constructor(code: LicenseErrorCode) {
    super(errorMessages[code]);
    this.name = 'LicenseError';
    this.code = code;
  }
}

const isPast = (iso: string | null, now: number) => iso !== null && Date.parse(iso) <= now;

// Without a server answer the license stays usable for GRACE_PERIOD_MS after the
// last successful check. A clock that reads earlier than that check, or earlier
// than any time the app has seen since, was set back and cannot be trusted, so
// it needs an online check too.
export function offlineStatus(license: StoredLicense, now: number): LicenseStatus {
  if (isPast(license.expiresAt, now)) {
    return { kind: 'expired', reason: 'subscription' };
  }
  const elapsed = now - Date.parse(license.lastValidatedAt);
  const seen = Date.parse(license.lastSeenAt);
  if (
    Number.isNaN(elapsed) ||
    Number.isNaN(seen) ||
    elapsed < 0 ||
    now < seen ||
    elapsed > GRACE_PERIOD_MS
  ) {
    return { kind: 'expired', reason: 'offline' };
  }
  return { daysLeft: Math.ceil((GRACE_PERIOD_MS - elapsed) / DAY_MS), kind: 'grace' };
}

// Moves lastSeenAt forward to now, never back. An unreadable value stays as it
// is, so offlineStatus keeps asking for an online check.
function seenAt(license: StoredLicense, now: number): StoredLicense {
  const seen = Date.parse(license.lastSeenAt);
  return Number.isNaN(seen) || seen >= now
    ? license
    : { ...license, lastSeenAt: new Date(now).toISOString() };
}

export function resolveLicense(
  license: StoredLicense,
  outcome: ValidationOutcome,
  now: number,
): { license: StoredLicense; status: LicenseStatus } {
  switch (outcome.kind) {
    case 'valid': {
      // Polar vouches for this moment, so it also resets the clock high-water mark.
      const checkedAt = new Date(now).toISOString();
      return {
        license: {
          ...license,
          ...outcome.details,
          lastSeenAt: checkedAt,
          lastValidatedAt: checkedAt,
        },
        status: { kind: 'valid' },
      };
    }
    case 'inactive':
      return { license: seenAt(license, now), status: { kind: 'expired', reason: 'subscription' } };
    case 'invalid':
      return {
        license: seenAt(license, now),
        status: isPast(license.expiresAt, now)
          ? { kind: 'expired', reason: 'subscription' }
          : { kind: 'invalid' },
      };
    case 'offline':
      return { license: seenAt(license, now), status: offlineStatus(license, now) };
  }
}

/**
 * The hourly recount between server checks, while the app is open: lastSeenAt
 * moves forward, and a grace period counts down until it needs an online check.
 */
export function refreshLicense(
  license: StoredLicense,
  status: LicenseStatus,
  now: number,
): { license: StoredLicense; status: LicenseStatus } {
  return {
    license: seenAt(license, now),
    status: status.kind === 'grace' ? offlineStatus(license, now) : status,
  };
}

export function activatedLicense(
  key: string,
  activationId: string,
  details: LicenseDetails,
  now: number,
): StoredLicense {
  const checkedAt = new Date(now).toISOString();
  return { ...details, activationId, key, lastSeenAt: checkedAt, lastValidatedAt: checkedAt };
}

const isNullableString = (value: unknown) => value === null || typeof value === 'string';

export function parseStoredLicense(value: unknown): StoredLicense | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const license = value as Record<string, unknown>;
  if (
    typeof license.activationId !== 'string' ||
    typeof license.displayKey !== 'string' ||
    typeof license.key !== 'string' ||
    !license.key ||
    typeof license.lastSeenAt !== 'string' ||
    typeof license.lastValidatedAt !== 'string' ||
    !isNullableString(license.customerEmail) ||
    !isNullableString(license.expiresAt)
  ) {
    return null;
  }
  return {
    activationId: license.activationId,
    customerEmail: license.customerEmail as string | null,
    displayKey: license.displayKey,
    expiresAt: license.expiresAt as string | null,
    key: license.key,
    lastSeenAt: license.lastSeenAt,
    lastValidatedAt: license.lastValidatedAt,
  };
}
