// The license status for MCP calls, which run outside React. No React or
// Tauri imports, so tests can drive it with fake timers.
import { isUnlocked } from './license.ts';

/** How long a call waits for the launch license check. */
export const LICENSE_WAIT_MS = 20_000;

export type LicenseAnswer = 'checking' | 'locked' | 'ok';

export interface LicenseWait {
  /** 'checking' when the launch check did not settle within LICENSE_WAIT_MS. */
  answer: () => Promise<LicenseAnswer>;
  /** Records the status; a settled one wakes every waiting call. */
  set: (kind: string) => void;
}

export function createLicenseWait(initial: string): LicenseWait {
  let kind = initial;
  const waiters = new Set<() => void>();

  return {
    answer: async () => {
      if (kind === 'checking') {
        await new Promise<void>((resolve) => {
          const wake = () => {
            clearTimeout(timer);
            waiters.delete(wake);
            resolve();
          };
          const timer = setTimeout(wake, LICENSE_WAIT_MS);
          waiters.add(wake);
        });
      }
      if (kind === 'checking') {
        return 'checking';
      }
      return isUnlocked({ kind }) ? 'ok' : 'locked';
    },
    set: (next) => {
      kind = next;
      if (kind !== 'checking') {
        for (const wake of waiters) {
          wake();
        }
      }
    },
  };
}
