import { toast } from '@angaria/ui';
import { useQueryClient } from '@tanstack/react-query';
import { isTauri } from '@tauri-apps/api/core';
import { useCallback, useEffect, useRef } from 'react';
import {
  cancelInvoice,
  createDraftInvoice,
  fetchTCMBRateTable,
  getDrafts,
  getInvoiceDetail,
  getInvoiceHTML,
} from '@/lib/angaria.ts';
import { customerName, defaultPDFLanguage, learnCustomer } from '@/lib/customer.ts';
import { errorMessage } from '@/lib/gib-errors.ts';
import { gib, useGIBAccount } from '@/lib/gib.ts';
import { saveDueDate } from '@/lib/invoice-due-dates.ts';
import { cleanItems, invoiceDefaults, upsertSavedItems } from '@/lib/invoice-form.ts';
import { rangeCovering } from '@/lib/invoices.ts';
import { useLicense } from '@/lib/license-context.tsx';
import {
  mcpRespond,
  mcpStart,
  mcpStop,
  onMcpCall,
  onMcpCancel,
  type McpToolCall,
} from '@/lib/mcp-native.ts';
import type { McpToolContext } from '@/lib/mcp-tools.ts';
import { recordMcpCall, setMcpServerState, useMcpSettings } from '@/lib/mcp.ts';
import type { GIBAccount } from '@/lib/session-queue.ts';
import { useStore } from '@/lib/store.tsx';
import { router } from '../router.tsx';

/**
 * A call still waiting in the GİB queue (behind an SMS approval, say) gives up
 * before MCP clients' usual 60 second timeout, so a client that gave up and
 * retries never leaves a second draft behind. A started call runs to its end.
 */
const QUEUE_DEADLINE_MS = 45_000;
/** How long a call waits for the launch license check. */
const LICENSE_WAIT_MS = 20_000;

interface Snapshot {
  account: GIBAccount;
  store: ReturnType<typeof useStore>;
}

/**
 * Runs the built-in MCP server's tools while Angaria › MCP has it on
 * (docs/adr/0009-built-in-mcp-server.md): starts the Rust server with the
 * tool list, runs each `mcp:call` with the active company's store, login and
 * GİB queue, and sends the result back. Mounted outside the license gate, so a
 * locked app still answers with the license error.
 */
export function McpHost() {
  const { enabled, port } = useMcpSettings();
  const store = useStore();
  const account = useGIBAccount();
  const queryClient = useQueryClient();
  const { status } = useLicense();

  // Calls outlive the render they started in.
  const latest = useRef({ account, store });
  useEffect(() => {
    latest.current = { account, store };
  }, [account, store]);

  const license = useRef({ kind: status.kind, waiters: new Set<() => void>() });
  useEffect(() => {
    license.current.kind = status.kind;
    if (status.kind !== 'checking') {
      for (const wake of license.current.waiters) {
        wake();
      }
      license.current.waiters.clear();
    }
  }, [status.kind]);

  /**
   * A call's context: the account and store as the call arrived, so a
   * company switch while it waits never mixes two companies' data.
   */
  const contextFor = useCallback(
    ({ account, store }: Snapshot): McpToolContext => ({
      client: { cancelInvoice, createDraftInvoice, getDrafts, getInvoiceDetail, getInvoiceHTML },
      company: () => {
        const { activeEntity, hasCredentials, savedItems, savedRecipients } = store;
        return {
          customers: savedRecipients,
          hasCredentials,
          name: activeEntity.name,
          services: savedItems,
        };
      },
      currencyRate: async (currency, date) => (await fetchTCMBRateTable(date)).rates.get(currency),
      // The signal drops a waiting task; a started one runs to its end.
      gib: (task, signal) => gib.run(account, (session) => task(session), { signal }),
      license: async () => {
        const state = license.current;
        if (state.kind === 'checking') {
          await new Promise<void>((resolve) => {
            state.waiters.add(resolve);
            setTimeout(resolve, LICENSE_WAIT_MS);
          });
        }
        if (state.kind === 'checking') {
          return 'checking';
        }
        return state.kind === 'valid' || state.kind === 'grace' ? 'ok' : 'locked';
      },
      newId: () => crypto.randomUUID(),
      now: () => new Date(),
      // What Yeni fatura does after a draft: the list, the due date, the
      // customer and services learned. The snapshot's setters write to the
      // company the draft was made for.
      onDraftCreated: (draft, values) => {
        void queryClient.invalidateQueries({ queryKey: ['invoices', account.key] });
        if (latest.current.store.activeEntityId === store.activeEntityId) {
          store.setInvoiceDateRange((range) => rangeCovering(range, draft.date));
        }
        if (draft.uuid && values.advancedFields.dueDate) {
          saveDueDate(draft.uuid, values.advancedFields.dueDate);
        }
        store.setSavedItems((saved) =>
          upsertSavedItems(saved, cleanItems(values.items), store.newId),
        );
        const pdfLanguage = values.recipient.pdfLanguage ?? defaultPDFLanguage(values.recipient);
        store.setSavedRecipients(
          (customers) =>
            learnCustomer(
              customers,
              values.recipient,
              invoiceDefaults(values, { date: draft.date, pdfLanguage }),
              store.newId,
            ).customers,
        );
        toast.success('MCP ile taslak oluşturuldu', {
          action: draft.uuid
            ? {
                label: 'Aç',
                onClick: () =>
                  void router.navigate({ params: { ettn: draft.uuid }, to: '/faturalar/$ettn' }),
              }
            : undefined,
          description: `${customerName(values.recipient)}. SMS ile onaylamak için aç.`,
        });
      },
      onDraftDeleted: () =>
        void queryClient.invalidateQueries({ queryKey: ['invoices', account.key] }),
    }),
    [queryClient],
  );

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    if (!enabled) {
      setMcpServerState({ kind: 'off' });
      void mcpStop().catch(() => {});
      return;
    }
    let disposed = false;
    const unlisten: Array<() => void> = [];
    const running = new Map<number, AbortController>();

    async function run({ arguments: args, id, name }: McpToolCall) {
      const controller = new AbortController();
      running.set(id, controller);
      const deadline = setTimeout(() => controller.abort(), QUEUE_DEADLINE_MS);
      try {
        // Loaded with the first call or the server's start, not at launch.
        const { callMcpTool } = await import('@/lib/mcp-tools.ts');
        const result = await callMcpTool(contextFor(latest.current), name, args, controller.signal);
        recordMcpCall({ at: new Date(), id, ok: result.isError !== true, tool: name });
        await mcpRespond(id, result);
      } finally {
        clearTimeout(deadline);
        running.delete(id);
      }
    }

    setMcpServerState({ kind: 'starting' });
    void (async () => {
      const { mcpToolList } = await import('@/lib/mcp-tools.ts');
      const stopCalls = await onMcpCall((call) => void run(call).catch(() => {}));
      const stopCancels = await onMcpCancel((id) => running.get(id)?.abort());
      unlisten.push(stopCalls, stopCancels);
      if (disposed) {
        stopCalls();
        stopCancels();
        return;
      }
      const started = await mcpStart(port, mcpToolList());
      if (!disposed) {
        setMcpServerState({ kind: 'running', port: started.port ?? port });
      }
    })().catch((error: unknown) => {
      if (!disposed) {
        setMcpServerState({ kind: 'failed', message: errorMessage(error) });
      }
    });

    return () => {
      disposed = true;
      for (const stop of unlisten.splice(0)) {
        stop();
      }
      // Calls still waiting for GİB answer busy; started ones finish.
      for (const controller of running.values()) {
        controller.abort();
      }
    };
  }, [contextFor, enabled, port]);

  return null;
}
