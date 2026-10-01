import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  FOCUS_CHECK_INTERVAL_MS,
  RECHECK_INTERVAL_MS,
  REFRESH_INTERVAL_MS,
  watchLicense,
} from '../src/lib/license-watch.ts';
import {
  activatedLicense,
  GRACE_PERIOD_MS,
  refreshLicense,
  resolveLicense,
  type LicenseStatus,
  type StoredLicense,
  type ValidationOutcome,
} from '../src/lib/license.ts';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const start = Date.parse('2026-10-01T09:00:00.000Z');

function fakeDocument() {
  const target = new EventTarget();
  return Object.assign(target, { visibilityState: 'visible' as DocumentVisibilityState });
}

function watch() {
  const check = vi.fn();
  const refresh = vi.fn();
  const window = new EventTarget();
  const document = fakeDocument();
  const stop = watchLicense({ check, document, refresh, window });
  return { check, document, refresh, stop, window };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(start);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('watchLicense', () => {
  test('recounts offline every hour and asks Polar every six hours', () => {
    const { check, refresh } = watch();

    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(check).not.toHaveBeenCalled();

    vi.advanceTimersByTime(RECHECK_INTERVAL_MS - REFRESH_INTERVAL_MS);
    expect(check).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(5);

    vi.advanceTimersByTime(RECHECK_INTERVAL_MS);
    expect(check).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(10);
  });

  test('focus asks Polar at most once per fifteen minutes', () => {
    const { check, window } = watch();

    window.dispatchEvent(new Event('focus'));
    expect(check).not.toHaveBeenCalled();

    vi.advanceTimersByTime(FOCUS_CHECK_INTERVAL_MS - 1);
    window.dispatchEvent(new Event('focus'));
    expect(check).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('focus'));
    expect(check).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(FOCUS_CHECK_INTERVAL_MS);
    window.dispatchEvent(new Event('focus'));
    expect(check).toHaveBeenCalledTimes(2);
  });

  test('a visible window asks Polar, a hidden one does not', () => {
    const { check, document } = watch();
    vi.advanceTimersByTime(FOCUS_CHECK_INTERVAL_MS);

    document.visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(check).not.toHaveBeenCalled();

    document.visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(check).toHaveBeenCalledTimes(1);
  });

  test('a check on focus restarts the six hours', () => {
    const { check, refresh, window } = watch();

    vi.advanceTimersByTime(5 * HOUR);
    window.dispatchEvent(new Event('focus'));
    expect(check).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * HOUR);
    expect(check).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(10);

    vi.advanceTimersByTime(HOUR);
    expect(check).toHaveBeenCalledTimes(2);
  });

  test('time spent asleep counts: the first tick after a long sleep asks Polar', () => {
    const { check, refresh } = watch();

    // Timers do not run while the Mac sleeps, the wall clock does.
    vi.setSystemTime(start + 10 * HOUR);
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
    expect(check).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  test('a clock set back asks Polar on the next focus', () => {
    const { check, window } = watch();

    vi.setSystemTime(start - 2 * HOUR);
    window.dispatchEvent(new Event('focus'));
    expect(check).toHaveBeenCalledTimes(1);
  });

  test('stops when the license locks', () => {
    const { check, refresh, stop, window } = watch();
    stop();

    vi.advanceTimersByTime(RECHECK_INTERVAL_MS * 2);
    window.dispatchEvent(new Event('focus'));
    expect(check).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});

// The provider's wiring without React: the watcher drives the state machine.
function session(answer: () => ValidationOutcome) {
  let state: { license: StoredLicense; status: LicenseStatus } = {
    license: activatedLicense(
      'ANGARIA-KEY',
      'activation-1',
      { customerEmail: null, displayKey: '****-ABCD', expiresAt: null },
      Date.now(),
    ),
    status: { kind: 'valid' },
  };
  const stop = watchLicense({
    check: () => {
      state = resolveLicense(state.license, answer(), Date.now());
    },
    document: fakeDocument(),
    refresh: () => {
      state = refreshLicense(state.license, state.status, Date.now());
    },
    window: new EventTarget(),
  });
  return { state: () => state, stop };
}

describe('an open app', () => {
  test('runs out the offline grace period without a relaunch', () => {
    const app = session(() => ({ kind: 'offline' }));

    vi.advanceTimersByTime(RECHECK_INTERVAL_MS);
    expect(app.state().status).toEqual({ daysLeft: 7, kind: 'grace' });

    vi.advanceTimersByTime(3 * 24 * HOUR);
    expect(app.state().status).toEqual({ daysLeft: 4, kind: 'grace' });

    vi.advanceTimersByTime(GRACE_PERIOD_MS - 3 * 24 * HOUR - RECHECK_INTERVAL_MS);
    expect(app.state().status).toEqual({ daysLeft: 0, kind: 'grace' });

    vi.advanceTimersByTime(HOUR);
    expect(app.state().status).toEqual({ kind: 'expired', reason: 'offline' });
    app.stop();
  });

  test('locks within six hours of a revocation', () => {
    let revoked = false;
    const app = session(() =>
      revoked
        ? { kind: 'inactive' }
        : {
            details: { customerEmail: null, displayKey: '****-ABCD', expiresAt: null },
            kind: 'valid',
          },
    );

    vi.advanceTimersByTime(RECHECK_INTERVAL_MS);
    expect(app.state().status).toEqual({ kind: 'valid' });

    revoked = true;
    vi.advanceTimersByTime(RECHECK_INTERVAL_MS - 1);
    expect(app.state().status).toEqual({ kind: 'valid' });
    vi.advanceTimersByTime(1);
    expect(app.state().status).toEqual({ kind: 'expired', reason: 'subscription' });
    app.stop();
  });

  test('a clock set back while offline needs an online check', () => {
    const app = session(() => ({ kind: 'offline' }));

    vi.advanceTimersByTime(3 * 24 * HOUR);
    expect(app.state().status).toEqual({ daysLeft: 4, kind: 'grace' });

    vi.setSystemTime(Date.now() - 2 * 24 * HOUR);
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
    expect(app.state().status).toEqual({ kind: 'expired', reason: 'offline' });
    app.stop();
  });
});
