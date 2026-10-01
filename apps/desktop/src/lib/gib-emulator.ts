// Dev only: Ayarlar › GİB hesabı › Emülatör sends GİB and TCMB calls to the
// local emulator (`pnpm emulate`, packages/gib-emulator). Its URL comes from
// .env.development, and import.meta.env.DEV is statically false in production
// builds, so neither the URL nor the switch ships.

const STORAGE_KEY = 'angaria-gib-emulator';

/** The emulator's URL while developing, undefined in production builds. */
export const gibEmulatorURL = import.meta.env.DEV
  ? import.meta.env.VITE_GIB_EMULATOR_URL || undefined
  : undefined;

function switchedOn() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Where GİB and TCMB calls go instead of the real hosts: set while the switch is on. */
export const activeGibEmulatorURL = gibEmulatorURL && switchedOn() ? gibEmulatorURL : undefined;

/** Turns the switch on or off, then reloads so no session or cached GİB data crosses over. */
export function setGibEmulator(on: boolean) {
  if (on) {
    localStorage.setItem(STORAGE_KEY, '1');
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  window.location.reload();
}
