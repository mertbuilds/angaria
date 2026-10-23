// Keeps an open, unlocked app honest: a license checked only at launch would
// never run out its offline grace period and a revoked one would work until
// quit. No Tauri imports, so tests can drive it with fake timers.

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** How often an open app asks Polar again. */
export const RECHECK_INTERVAL_MS = 6 * HOUR_MS;
/** How often the offline grace period is recounted between checks. */
export const REFRESH_INTERVAL_MS = HOUR_MS;
/** Coming back to the window asks Polar again, at most this often. */
export const FOCUS_CHECK_INTERVAL_MS = 15 * MINUTE_MS;

export interface LicenseWatchOptions {
  /** Asks Polar and resolves the license. */
  check: () => void;
  document?: EventTarget & { readonly visibilityState: DocumentVisibilityState };
  now?: () => number;
  /** Recounts the license offline (lastSeenAt, grace period). */
  refresh: () => void;
  window?: EventTarget;
}

/**
 * Starts right after a check (launch, activation, retry). Every hour it either
 * recounts offline or, once RECHECK_INTERVAL_MS has passed since the last
 * check, asks Polar again; focus and visibility changes ask early. Elapsed time
 * is wall-clock time, so hours spent asleep count, and a clock that moved back
 * counts as due. Returns a function that stops it.
 */
export function watchLicense({
  check,
  document: doc = globalThis.document,
  now = Date.now,
  refresh,
  window: win = globalThis.window,
}: LicenseWatchOptions): () => void {
  let lastCheck = now();

  const due = (interval: number) => {
    const elapsed = now() - lastCheck;
    return elapsed < 0 || elapsed >= interval;
  };

  const runCheck = () => {
    lastCheck = now();
    check();
  };

  const timer = setInterval(
    () => (due(RECHECK_INTERVAL_MS) ? runCheck() : refresh()),
    REFRESH_INTERVAL_MS,
  );

  const onActive = () => {
    if (doc.visibilityState !== 'hidden' && due(FOCUS_CHECK_INTERVAL_MS)) {
      runCheck();
    }
  };

  win.addEventListener('focus', onActive);
  doc.addEventListener('visibilitychange', onActive);

  return () => {
    clearInterval(timer);
    win.removeEventListener('focus', onActive);
    doc.removeEventListener('visibilitychange', onActive);
  };
}
