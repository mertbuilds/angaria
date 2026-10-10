import { describe, expect, test, vi } from 'vitest';
import { createMcpState, SIGNING_TTL_MS, SMS_INTERVAL_MS } from '../src/lib/mcp-state.ts';
import type { SessionLease } from '../src/lib/session-queue.ts';

const lease = (): SessionLease => ({
  release: vi.fn(),
  session: { baseUrl: 'https://test.invalid', cookies: [], token: 't' },
});

function fixture() {
  let now = 0;
  const ended: Array<string> = [];
  let ids = 0;
  const state = createMcpState({
    clearTimer: () => {},
    newId: () => `op-${++ids}`,
    now: () => now,
    onSigningEnd: (operation, reason) => ended.push(`${operation.id} ${reason}`),
    setTimer: () => 0 as unknown as ReturnType<typeof setTimeout>,
  });
  const start = () =>
    state.signing.start({
      companyId: 'main',
      invoices: [{ date: '02/10/2026', recipient: 'ACME', uuid: 'u1' }],
      lease: lease(),
      oid: 'oid',
      phone: '5550000001',
    });
  return { advance: (ms: number) => (now += ms), ended, start, state };
}

describe('signing operations', () => {
  test('one at a time: a new one ends the last and hands its session back', () => {
    const { ended, start, state } = fixture();
    const first = start();
    const second = start();
    expect(first.lease.release).toHaveBeenCalledWith(undefined);
    expect(ended).toEqual(['op-1 replaced']);
    expect(state.signing.find('op-1')).toBeNull();
    expect(state.signing.find('op-2')).toBe(second);
  });

  test('expire by the clock even when the timer is late', () => {
    const { advance, ended, start, state } = fixture();
    const operation = start();
    advance(SIGNING_TTL_MS);
    expect(state.signing.find(operation.id)).toBe('expired');
    expect(operation.lease.release).toHaveBeenCalled();
    expect(ended).toEqual(['op-1 expired']);
    expect(state.signing.find(operation.id)).toBe('expired');
  });

  test('one SMS per interval, and dispose ends what is open', () => {
    const { advance, ended, start, state } = fixture();
    expect(state.signing.smsWait()).toBe(0);
    start();
    expect(state.signing.smsWait()).toBe(SMS_INTERVAL_MS / 1000);
    advance(SMS_INTERVAL_MS);
    expect(state.signing.smsWait()).toBe(0);
    state.dispose();
    expect(ended).toEqual(['op-1 cancelled']);
  });
});

test('allow counts calls in a sliding window', () => {
  const { advance, state } = fixture();
  expect(state.allow('x', 2, 1000)).toEqual({ ok: true });
  advance(400);
  expect(state.allow('x', 2, 1000)).toEqual({ ok: true });
  expect(state.allow('x', 2, 1000)).toEqual({ ok: false, wait: 1 });
  advance(601);
  expect(state.allow('x', 2, 1000)).toEqual({ ok: true });
});
