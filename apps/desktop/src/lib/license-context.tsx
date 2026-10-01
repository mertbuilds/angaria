import { toast } from '@angaria/ui';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { openUrl } from '@tauri-apps/plugin-opener';
import { hostname } from '@tauri-apps/plugin-os';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SecretStore } from './credentials.ts';
import { reportKeychainError } from './keychain-error.ts';
import { clearLicense, loadLicense, saveLicense } from './license-vault.ts';
import { watchLicense } from './license-watch.ts';
import {
  activatedLicense,
  LicenseError,
  refreshLicense,
  resolveLicense,
  type LicenseStatus,
  type StoredLicense,
} from './license.ts';
import { secretDelete, secretGet, secretSet } from './native.ts';
import { createPolarClient } from './polar.ts';

const secrets: SecretStore = { delete: secretDelete, get: secretGet, set: secretSet };

const KEYCHAIN_ERROR = 'Lisans bilgilerine sistem anahtar zincirinde erişilemedi.';

// import.meta.env.DEV is statically false in production builds, so the bypass
// cannot ship even if VITE_LICENSE_BYPASS is set there.
export const licenseBypassed = import.meta.env.DEV && import.meta.env.VITE_LICENSE_BYPASS === '1';

const polar = createPolarClient({
  apiBase: import.meta.env.VITE_POLAR_API_BASE,
  fetch: tauriFetch,
  organizationId: import.meta.env.VITE_POLAR_ORGANIZATION_ID,
});

function openExternal(url: string) {
  openUrl(url).catch(() => toast.error('Bağlantı açılamadı.'));
}

export const openCheckout = () => openExternal(import.meta.env.VITE_POLAR_CHECKOUT_URL);
export const openCustomerPortal = () => openExternal(import.meta.env.VITE_POLAR_PORTAL_URL);

// One license operation at a time, so a check that ends after a deactivate
// cannot write the license back.
let queue: Promise<unknown> = Promise.resolve();

function serially<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next;
  return next;
}

export type LicenseState = LicenseStatus | { kind: 'checking' };

interface LicenseSnapshot {
  error: string | null;
  license: StoredLicense | null;
  status: LicenseState;
}

const unlicensed = (error: string | null = null): LicenseSnapshot => ({
  error,
  license: null,
  status: { kind: 'unlicensed' },
});

async function checkLicense(): Promise<LicenseSnapshot> {
  try {
    const stored = await loadLicense(secrets, localStorage);
    if (!stored) {
      return unlicensed();
    }
    const outcome = await polar.validate(stored.key, stored.activationId);
    const next = resolveLicense(stored, outcome, Date.now());
    await saveLicense(secrets, next.license);
    return { error: null, ...next };
  } catch (error) {
    return unlicensed(reportKeychainError(KEYCHAIN_ERROR, error));
  }
}

// Between checks: recounts the grace period and records the time seen.
async function refreshSnapshot(snapshot: LicenseSnapshot): Promise<LicenseSnapshot> {
  const { license, status } = snapshot;
  if (!license || (status.kind !== 'valid' && status.kind !== 'grace')) {
    return snapshot;
  }
  const next = refreshLicense(license, status, Date.now());
  try {
    await saveLicense(secrets, next.license);
  } catch (error) {
    return unlicensed(reportKeychainError(KEYCHAIN_ERROR, error));
  }
  return { error: null, ...next };
}

interface LicenseContextValue extends LicenseSnapshot {
  activate: (key: string) => Promise<void>;
  bypassed: boolean;
  check: () => Promise<void>;
  deactivate: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

export function useLicense() {
  const ctx = useContext(LicenseContext);
  if (!ctx) {
    throw new Error('useLicense must be used within LicenseProvider');
  }
  return ctx;
}

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<LicenseSnapshot>({
    error: null,
    license: null,
    status: licenseBypassed ? { kind: 'valid' } : { kind: 'checking' },
  });
  // The latest snapshot for queued tasks, which outlive the render they started in.
  const latest = useRef(snapshot);

  const update = useCallback((next: LicenseSnapshot) => {
    latest.current = next;
    setSnapshot(next);
  }, []);

  const check = useCallback(() => serially(async () => update(await checkLicense())), [update]);

  const refresh = useCallback(
    () => serially(async () => update(await refreshSnapshot(latest.current))),
    [update],
  );

  const activate = useCallback(
    (input: string) =>
      serially(async () => {
        const key = input.trim();
        const label = (await hostname().catch(() => null)) || 'Angaria';
        const result = await polar.activate(key, label);
        if (result.kind !== 'activated') {
          throw new LicenseError(result.kind);
        }
        const license = activatedLicense(key, result.activationId, result.details, Date.now());
        try {
          await saveLicense(secrets, license);
        } catch (error) {
          await polar.deactivate(key, result.activationId);
          throw new Error(
            reportKeychainError('Lisans anahtarı sistem anahtar zincirine kaydedilemedi.', error),
            { cause: error },
          );
        }
        update({ error: null, license, status: { kind: 'valid' } });
      }),
    [update],
  );

  const deactivate = useCallback(
    () =>
      serially(async () => {
        const stored = await loadLicense(secrets, localStorage);
        if (stored) {
          const result = await polar.deactivate(stored.key, stored.activationId);
          if (result.kind !== 'deactivated') {
            throw new LicenseError(result.kind);
          }
        }
        await clearLicense(secrets);
        update(unlicensed());
      }),
    [update],
  );

  useEffect(() => {
    if (licenseBypassed) {
      return;
    }
    let current = true;
    void serially(async () => {
      const next = await checkLicense();
      if (current) {
        update(next);
      }
    });
    return () => {
      current = false;
    };
  }, [update]);

  // While the app is unlocked, check again every few hours and on focus, and
  // count the grace period down, so it can lock mid-session. The store sits
  // outside the gate, so a lock keeps the invoice form.
  const unlocked = snapshot.status.kind === 'valid' || snapshot.status.kind === 'grace';
  useEffect(() => {
    if (licenseBypassed || !unlocked) {
      return;
    }
    return watchLicense({ check: () => void check(), refresh: () => void refresh() });
  }, [check, refresh, unlocked]);

  const value = useMemo(
    () => ({ ...snapshot, activate, bypassed: licenseBypassed, check, deactivate }),
    [activate, check, deactivate, snapshot],
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}
