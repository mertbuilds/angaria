// What the built-in MCP server's tools keep between calls while the server
// runs (docs/adr/0010-mcp-agent-actions.md): SMS signing operations and their
// leased GİB sessions, the rate limits of agent actions, and the finished
// scans of Faturalardan içe aktar (the scan itself is the app's one import
// run, src/lib/import-run.ts). One per server run, so switching MCP off forgets
// it all. No Tauri or React imports, so tests drive it with a fake clock.
import type { ImportPeriod, ScannedInvoice } from './gib-import.ts';
import type { SessionLease } from './session-queue.ts';

/**
 * How long an SMS signing operation lives: GİB's SMS şifresi expires after
 * about three minutes (the emulator's `smsTtlSeconds`). The leased GİB session
 * goes back to the queue with it.
 */
export const SIGNING_TTL_MS = 180_000;

/** Wrong SMS codes one operation takes before it ends. */
export const SIGNING_ATTEMPTS = 3;

/** One SMS şifresi per this long, as the app's Kodu tekrar gönder waits. */
export const SMS_INTERVAL_MS = 60_000;

/** A draft an operation signs, as request_signing_sms found it. */
export interface SigningInvoice {
  /** DD/MM/YYYY */
  date: string;
  number?: string;
  recipient: string;
  uuid: string;
}

export interface SigningOperation {
  /** Wrong codes so far */
  attempts: number;
  /** A sign_invoices call is running on it */
  busy: boolean;
  companyId: string;
  /** ms since the epoch */
  expiresAt: number;
  id: string;
  invoices: ReadonlyArray<SigningInvoice>;
  /** The GİB session the code was sent on: only it can verify the code. */
  lease: SessionLease;
  oid: string;
  phone: string;
}

/** Why an operation ended. */
export type SigningEnd = 'cancelled' | 'expired' | 'failed' | 'replaced' | 'signed';

/** A finished import run scan_gib_import returned, for apply_gib_import. */
export interface ImportScan {
  companyId: string;
  id: string;
  invoices: ReadonlyArray<ScannedInvoice>;
  period: ImportPeriod;
}

export interface McpStateOptions {
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  newId?: () => string;
  now?: () => number;
  onSigningEnd?: (operation: SigningOperation, reason: SigningEnd) => void;
  setTimer?: (run: () => void, ms: number) => ReturnType<typeof setTimeout>;
}

export type McpState = ReturnType<typeof createMcpState>;

export function createMcpState({
  clearTimer = clearTimeout,
  newId = () => crypto.randomUUID(),
  now = Date.now,
  onSigningEnd,
  setTimer = setTimeout,
}: McpStateOptions = {}) {
  const operations = new Map<
    string,
    { operation: SigningOperation; timer: ReturnType<typeof setTimeout> }
  >();
  const expired = new Set<string>();
  const calls = new Map<string, Array<number>>();
  /** By scanId */
  const scans = new Map<string, ImportScan>();
  let lastSMSAt: number | null = null;

  function end(id: string, reason: SigningEnd, error?: unknown) {
    const entry = operations.get(id);
    if (!entry) {
      return;
    }
    operations.delete(id);
    clearTimer(entry.timer);
    if (reason === 'expired') {
      expired.add(id);
    }
    entry.operation.lease.release(error);
    onSigningEnd?.(entry.operation, reason);
  }

  const signing = {
    /** Ends every open operation. */
    endAll: (reason: SigningEnd = 'cancelled') => {
      for (const id of operations.keys()) {
        end(id, reason);
      }
    },
    /** Ends the operation and hands its session back; `error` forces a new login. */
    end,
    /**
     * The open operation `id`; 'expired' for one that ran out, null for an id
     * this server run never made.
     */
    find: (id: string): SigningOperation | 'expired' | null => {
      const entry = operations.get(id);
      if (entry && now() >= entry.operation.expiresAt) {
        end(id, 'expired');
        return 'expired';
      }
      if (entry) {
        return entry.operation;
      }
      return expired.has(id) ? 'expired' : null;
    },
    /** Seconds until another SMS şifresi may be asked for; 0 when it may now. */
    smsWait: () =>
      lastSMSAt === null ? 0 : Math.max(0, Math.ceil((lastSMSAt + SMS_INTERVAL_MS - now()) / 1000)),
    /**
     * Opens an operation for a sent code. Only one is open at a time: a new
     * one ends the last and hands its session back.
     */
    start: (
      fields: Omit<SigningOperation, 'attempts' | 'busy' | 'expiresAt' | 'id'>,
    ): SigningOperation => {
      signing.endAll('replaced');
      lastSMSAt = now();
      const operation: SigningOperation = {
        ...fields,
        attempts: 0,
        busy: false,
        expiresAt: now() + SIGNING_TTL_MS,
        id: newId(),
      };
      const timer = setTimer(() => end(operation.id, 'expired'), SIGNING_TTL_MS);
      operations.set(operation.id, { operation, timer });
      return operation;
    },
  };

  /**
   * Counts a call of `key` and allows it while fewer than `max` were allowed
   * in the last `windowMs`; otherwise the seconds until one is.
   */
  function allow(
    key: string,
    max: number,
    windowMs: number,
  ): { ok: true } | { ok: false; wait: number } {
    const time = now();
    const recent = (calls.get(key) ?? []).filter((at) => at > time - windowMs);
    if (recent.length >= max) {
      calls.set(key, recent);
      return { ok: false, wait: Math.max(1, Math.ceil((recent[0] + windowMs - time) / 1000)) };
    }
    calls.set(key, [...recent, time]);
    return { ok: true };
  }

  return {
    allow,
    /** Ends every operation and forgets the scans: the server stopped. */
    dispose: () => {
      signing.endAll('cancelled');
      scans.clear();
    },
    newId,
    scans,
    signing,
  };
}
