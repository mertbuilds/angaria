import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { openUrl } from '@tauri-apps/plugin-opener';
import { hostname } from '@tauri-apps/plugin-os';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import {
  activatedLicense,
  LicenseError,
  parseStoredLicense,
  resolveLicense,
  type LicenseStatus,
  type StoredLicense,
} from './license.ts';
import { secretDelete, secretGet, secretSet } from './native.ts';
import { createPolarClient } from './polar.ts';

const LICENSE_SECRET_KEY = 'license-key';
const LICENSE_STORAGE_KEY = 'angaria-license';

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

function readStoredLicense(): StoredLicense | null {
  try {
    return parseStoredLicense(JSON.parse(localStorage.getItem(LICENSE_STORAGE_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

function writeStoredLicense(license: StoredLicense | null) {
  if (license) {
    localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(license));
  } else {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
  }
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
    const stored = readStoredLicense();
    const key = stored ? await secretGet(LICENSE_SECRET_KEY) : null;
    if (!stored || !key) {
      return unlicensed();
    }
    const outcome = await polar.validate(key, stored.activationId);
    const next = resolveLicense(stored, outcome, Date.now());
    writeStoredLicense(next.license);
    return { error: null, ...next };
  } catch {
    return unlicensed('Lisans anahtarı sistem anahtar zincirinden okunamadı.');
  }
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

  const check = useCallback(async () => setSnapshot(await checkLicense()), []);

  const activate = useCallback(async (input: string) => {
    const key = input.trim();
    const label = (await hostname().catch(() => null)) || 'Angaria';
    const result = await polar.activate(key, label);
    if (result.kind !== 'activated') {
      throw new LicenseError(result.kind);
    }
    try {
      await secretSet(LICENSE_SECRET_KEY, key);
    } catch {
      await polar.deactivate(key, result.activationId);
      throw new Error('Lisans anahtarı sistem anahtar zincirine kaydedilemedi.');
    }
    const license = activatedLicense(result.activationId, result.details, Date.now());
    writeStoredLicense(license);
    setSnapshot({ error: null, license, status: { kind: 'valid' } });
  }, []);

  const deactivate = useCallback(async () => {
    const stored = readStoredLicense();
    const key = await secretGet(LICENSE_SECRET_KEY);
    if (stored && key) {
      const result = await polar.deactivate(key, stored.activationId);
      if (result.kind !== 'deactivated') {
        throw new LicenseError(result.kind);
      }
    }
    await secretDelete(LICENSE_SECRET_KEY);
    writeStoredLicense(null);
    setSnapshot(unlicensed());
  }, []);

  useEffect(() => {
    if (licenseBypassed) {
      return;
    }
    let current = true;
    void checkLicense().then((next) => {
      if (current) {
        setSnapshot(next);
      }
    });
    return () => {
      current = false;
    };
  }, []);

  const value = useMemo(
    () => ({ ...snapshot, activate, bypassed: licenseBypassed, check, deactivate }),
    [activate, check, deactivate, snapshot],
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}
