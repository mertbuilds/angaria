// Faturalardan içe aktar runs one scan at a time for the whole app, whoever
// starts it (the dialog, an agent over MCP). The run outlives the dialog: it
// goes on in the background, and keeps what it fetched, so Tekrar dene after a
// stop goes on from there. No Tauri or React imports, so tests drive it.
import {
  importRange,
  importWeeks,
  newCheckpoint,
  scanInvoices,
  type ImportPeriod,
  type ScanCheckpoint,
  type ScanClient,
  type ScannedInvoice,
  type ScanOptions,
  type ScanProgress,
} from './gib-import.ts';
import type { DateRange } from './invoices.ts';

export interface ImportRun {
  companyId: string;
  /** Why it stopped, when `status` is failed */
  error?: unknown;
  id: string;
  /** The signed invoices read, when `status` is ready */
  invoices?: ReadonlyArray<ScannedInvoice>;
  period: ImportPeriod;
  progress: ScanProgress | null;
  status: 'failed' | 'ready' | 'scanning';
}

interface Entry {
  checkpoint: ScanCheckpoint;
  controller: AbortController;
  run: ImportRun;
  settled: Promise<void>;
  weeks: ReadonlyArray<DateRange>;
}

export interface ImportRunnerOptions {
  newId?: () => string;
  now?: () => Date;
  /** Pace and jitter for the scans (tests) */
  scan?: Pick<ScanOptions, 'pace' | 'random'>;
}

export type ImportRunner = ReturnType<typeof createImportRunner>;

export function createImportRunner({
  newId = () => crypto.randomUUID(),
  now = () => new Date(),
  scan,
}: ImportRunnerOptions = {}) {
  let entry: Entry | null = null;
  const listeners = new Set<() => void>();

  function update(target: Entry, change: Partial<ImportRun>) {
    // A cancelled or replaced run never writes over the one after it.
    if (entry !== target) {
      return;
    }
    target.run = { ...target.run, ...change };
    for (const listener of listeners) {
      listener();
    }
  }

  function scanOn(target: Entry, client: ScanClient) {
    target.controller = new AbortController();
    const { signal } = target.controller;
    target.settled = scanInvoices(client, target.weeks, {
      ...scan,
      checkpoint: target.checkpoint,
      onProgress: (progress) => update(target, { progress }),
      signal,
    }).then(
      (invoices) => update(target, { invoices, status: 'ready' }),
      (error: unknown) => {
        if (!signal.aborted) {
          update(target, { error, status: 'failed' });
        }
      },
    );
  }

  function set(next: Entry | null) {
    entry?.controller.abort();
    entry = next;
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    /** Stops the run and forgets it (Durdur, Vazgeç). `id` only when it is still that run. */
    cancel: (id?: string) => {
      if (entry && (id === undefined || entry.run.id === id)) {
        set(null);
      }
    },
    /** The run, null when there is none. A new object on every change. */
    current: (): ImportRun | null => entry?.run ?? null,
    /** A failed run goes on from where it stopped, with `client`. */
    retry: (client: ScanClient): ImportRun | null => {
      if (!entry || entry.run.status !== 'failed') {
        return entry?.run ?? null;
      }
      update(entry, { error: undefined, status: 'scanning' });
      scanOn(entry, client);
      return entry.run;
    },
    /** Settles when the run's scan ends, either way (at once without one). */
    settled: () => entry?.settled ?? Promise.resolve(),
    /**
     * Starts a scan of the company's signed invoices of `period`, unless one
     * is scanning: then that one comes back with `started` false. A finished
     * or failed run is replaced.
     */
    start: (
      companyId: string,
      period: ImportPeriod,
      client: ScanClient,
    ): { run: ImportRun; started: boolean } => {
      if (entry?.run.status === 'scanning') {
        return { run: entry.run, started: false };
      }
      const next: Entry = {
        checkpoint: newCheckpoint(),
        controller: new AbortController(),
        run: { companyId, id: newId(), period, progress: null, status: 'scanning' },
        settled: Promise.resolve(),
        weeks: importWeeks(importRange(period, now())),
      };
      set(next);
      scanOn(next, client);
      return { run: next.run, started: true };
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app's one import run, shared by the dialog and the MCP tools. */
export const importRuns = createImportRunner();
