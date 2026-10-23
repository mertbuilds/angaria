import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createLicenseWait, LICENSE_WAIT_MS } from '../src/lib/license-wait.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createLicenseWait', () => {
  test('answers at once from a settled status', async () => {
    const wait = createLicenseWait('valid');
    expect(await wait.answer()).toBe('ok');
    wait.set('grace');
    expect(await wait.answer()).toBe('ok');
    for (const kind of ['unlicensed', 'expired', 'invalid']) {
      wait.set(kind);
      expect(await wait.answer()).toBe('locked');
    }
  });

  test('a call during the launch check waits for it and answers from the final status', async () => {
    const wait = createLicenseWait('checking');
    const first = wait.answer();
    const second = wait.answer();

    await vi.advanceTimersByTimeAsync(LICENSE_WAIT_MS / 2);
    wait.set('valid');
    expect(await first).toBe('ok');
    expect(await second).toBe('ok');
    expect(vi.getTimerCount()).toBe(0);

    const locked = createLicenseWait('checking');
    const answer = locked.answer();
    locked.set('expired');
    expect(await answer).toBe('locked');
  });

  test('a check that does not settle within the wait answers checking', async () => {
    const wait = createLicenseWait('checking');
    const answer = wait.answer();

    await vi.advanceTimersByTimeAsync(LICENSE_WAIT_MS - 1);
    wait.set('checking');
    await vi.advanceTimersByTimeAsync(1);
    expect(await answer).toBe('checking');

    // A later settle answers the next call at once.
    wait.set('valid');
    expect(await wait.answer()).toBe('ok');
  });
});
