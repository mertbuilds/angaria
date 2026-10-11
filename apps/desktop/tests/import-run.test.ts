import { GibError } from 'angaria-earsiv-sdk';
import { describe, expect, test, vi } from 'vitest';
import { IMPORT_PACE, type ScanClient } from '../src/lib/gib-import.ts';
import { createImportRunner } from '../src/lib/import-run.ts';
import type { Invoice } from '../src/lib/types.ts';

const NOW = new Date(2026, 9, 10, 12);
const fast = { ...IMPORT_PACE, burstPauseMs: 0, gapMs: 0, jitterMs: 0 };

/** A fake GİB with one signed invoice, in the week from 26/09/2026. */
function fakeClient() {
  const calls: Array<string> = [];
  const client: ScanClient = {
    detail: async (ettn) => {
      calls.push(`detail ${ettn}`);
      return { aliciUnvan: 'ÖRNEK A.Ş.', paraBirimi: 'TRY', vknTckn: '4820193752' };
    },
    list: async (week) => {
      calls.push(`list ${week.start}`);
      return week.start === '26/09/2026'
        ? [{ belgeTarihi: '27-09-2026', ettn: 'signed', onayDurumu: 'Onaylandı' } as Invoice]
        : [];
    },
  };
  return { calls, client };
}

function runner() {
  let ids = 0;
  return createImportRunner({ newId: () => `run-${++ids}`, now: () => NOW, scan: { pace: fast } });
}

describe('the import run', () => {
  test('one at a time: a second start while one scans gets the running one', async () => {
    const runs = runner();
    const { calls, client } = fakeClient();
    const listener = vi.fn();
    runs.subscribe(listener);

    const first = runs.start('company', '3-ay', client);
    const second = runs.start('other', '1-yil', fakeClient().client);
    expect(first.started).toBe(true);
    expect(second).toEqual({ run: first.run, started: false });

    await runs.settled();
    const done = runs.current();
    expect(done).toMatchObject({
      companyId: 'company',
      id: 'run-1',
      period: '3-ay',
      status: 'ready',
    });
    expect(done?.invoices?.map((invoice) => invoice.ettn)).toEqual(['signed']);
    expect(calls.filter((call) => call.startsWith('detail'))).toEqual(['detail signed']);
    expect(listener).toHaveBeenCalled();

    // A finished run is replaced by the next start.
    const next = runs.start('other', '3-ay', client);
    expect(next.started).toBe(true);
    expect(next.run.id).toBe('run-2');
  });

  test('cancel stops the scan and forgets it; a stale id changes nothing', async () => {
    const runs = runner();
    const list = vi.fn<ScanClient['list']>(
      (_week, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
        ),
    );
    const { run } = runs.start('company', '3-ay', { ...fakeClient().client, list });
    runs.cancel('another-run');
    expect(runs.current()?.id).toBe(run.id);

    runs.cancel(run.id);
    expect(runs.current()).toBeNull();
    await runs.settled();
    expect(runs.current()).toBeNull();
  });

  test('a run that stopped goes on from where it stopped on retry', async () => {
    const runs = runner();
    const { calls, client } = fakeClient();
    const down = new GibError('network', 'GİB’e ulaşılamadı');
    let failed = false;
    const flaky: ScanClient = {
      ...client,
      list: async (week, signal) => {
        if (week.start === '26/09/2026' && !failed) {
          failed = true;
          throw down;
        }
        return client.list(week, signal);
      },
    };

    const { run } = runs.start('company', '3-ay', flaky);
    await runs.settled();
    expect(runs.current()).toMatchObject({ error: down, id: run.id, status: 'failed' });
    const listedBefore = calls.length;

    expect(runs.retry(flaky)).toMatchObject({ id: run.id, status: 'scanning' });
    await runs.settled();
    expect(runs.current()).toMatchObject({ id: run.id, status: 'ready' });
    // Only the week that failed and what came after it were fetched again.
    expect(calls.slice(listedBefore)).toEqual([
      'list 26/09/2026',
      'list 03/10/2026',
      'list 10/10/2026',
      'detail signed',
    ]);
  });
});
