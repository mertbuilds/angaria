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
import { vault } from './app-vault.ts';
import { reportKeychainError } from './keychain-error.ts';
import { watchLicense } from './license-watch.ts';
import {
  activatedLicense,
  LicenseError,
  normalizeLicenseKey,
  refreshLicense,
  resolveLicense,
  shouldSaveLicense,
  type LicenseStatus,
  type StoredLicense,
} from './license.ts';
import { createPolarClient } from './polar.ts';

const KEYCHAIN_ERROR = 'Lisans bilgileri Anahtar Zinciri’nden okunamadı.';

// import.meta.env.DEV is statically false in production builds, so the bypass
// cannot ship even if VITE_LICENSE_BYPASS is set there.
const licenseBypassed = import.meta.env.DEV && import.meta.env.VITE_LICENSE_BYPASS === '1';

const polar = createPolarClient({
  apiBase: import.meta.env.VITE_POLAR_API_BASE,
  fetch: tauriFetch,
  organizationId: import.meta.env.VITE_POLAR_ORGANIZATION_ID,
});

function openExternal(url: string) {
  openUrl(url).catch(() => toast.error('Sayfa tarayıcıda açılamadı. Tekrar dene.'));
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

// Keeps the license in memory and writes it only when shouldSaveLicense says
// the change is worth it. The status before the first check counts as no change.
const keepLicense = (
  next: { license: StoredLicense; status: LicenseStatus },
  previous: LicenseState,
) =>
  vault.setLicense(next.license, {
    save: shouldSaveLicense(
      vault.savedLicense(),
      next.license,
      previous.kind !== 'checking' && previous.kind !== next.status.kind,
    ),
  });

async function checkLicense(previous: LicenseState): Promise<LicenseSnapshot> {
  try {
    const stored = await vault.getLicense();
    if (!stored) {
      return unlicensed();
    }
    const outcome = await polar.validate(stored.key, stored.activationId);
    const next = resolveLicense(stored, outcome, Date.now());
    await keepLicense(next, previous);
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
    await keepLicense(next, status);
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

  const check = useCallback(
    () => serially(async () => update(await checkLicense(latest.current.status))),
    [update],
  );

  const refresh = useCallback(
    () => serially(async () => update(await refreshSnapshot(latest.current))),
    [update],
  );

  const activate = useCallback(
    (input: string) =>
      serially(async () => {
        const key = normalizeLicenseKey(input);
        const label = (await hostname().catch(() => null)) || 'Angaria';
        const result = await polar.activate(key, label);
        if (result.kind !== 'activated') {
          throw new LicenseError(result.kind);
        }
        const license = activatedLicense(key, result.activationId, result.details, Date.now());
        try {
          await vault.setLicense(license, { save: true });
        } catch (error) {
          await polar.deactivate(key, result.activationId);
          throw new Error(
            reportKeychainError('Lisans anahtarı Anahtar Zinciri’ne kaydedilemedi.', error),
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
        const stored = await vault.getLicense();
        if (stored) {
          const result = await polar.deactivate(stored.key, stored.activationId);
          if (result.kind !== 'deactivated') {
            throw new LicenseError(result.kind);
          }
        }
        await vault.setLicense(null, { save: true });
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
      const next = await checkLicense(latest.current.status);
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
