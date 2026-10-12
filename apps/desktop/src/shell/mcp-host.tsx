import { toast } from '@angaria/ui';
import { useQueryClient } from '@tanstack/react-query';
import { isTauri } from '@tauri-apps/api/core';
import { useCallback, useEffect, useRef } from 'react';
import {
  cancelInvoice,
  createDraftInvoice,
  downloadInvoice,
  fetchTCMBRateTable,
  getDrafts,
  getInvoiceDetail,
  getInvoiceHTML,
  startSMSSign,
  verifyAndSign,
} from '@/lib/angaria.ts';
import { companyKeys, resolveCompany } from '@/lib/company-identity.ts';
import { customerName, defaultPDFLanguage, learnCustomer } from '@/lib/customer.ts';
import { errorMessage } from '@/lib/gib-errors.ts';
import { gib, invoiceDetailQuery, invoiceHTMLQuery } from '@/lib/gib.ts';
import { importRuns } from '@/lib/import-run.ts';
import { dueDateOf, saveDueDate } from '@/lib/invoice-due-dates.ts';
import { saveAngariaPDF, saveEArchive } from '@/lib/invoice-files.ts';
import { cleanItems, invoiceDefaults, upsertSavedItems } from '@/lib/invoice-form.ts';
import { parseGIBInvoice, rangeCovering } from '@/lib/invoices.ts';
import { useLicense } from '@/lib/license-context.tsx';
import { activityInput } from '@/lib/mcp-activity-input.ts';
import {
  mcpRespond,
  mcpStart,
  mcpStop,
  onMcpCall,
  onMcpCancel,
  type McpToolCall,
} from '@/lib/mcp-native.ts';
import { createMcpState, type McpState } from '@/lib/mcp-state.ts';
import type { McpAction, McpToolContext } from '@/lib/mcp-tools.ts';
import { recordMcpActivity, setMcpServerState, useMcpSettings } from '@/lib/mcp.ts';
import type { GIBAccount } from '@/lib/session-queue.ts';
import { useStore } from '@/lib/store.tsx';
import type { Entity, Recipient, Service } from '@/lib/types.ts';
import { router } from '../router.tsx';

/**
 * A call still waiting in the GİB queue (behind an SMS approval, say) gives up
 * before MCP clients' usual 60 second timeout, so a client that gave up and
 * retries never leaves a second draft behind. A started call runs to its end.
 */
const QUEUE_DEADLINE_MS = 45_000;
/** How long a call waits for the launch license check. */
const LICENSE_WAIT_MS = 20_000;

type Store = ReturnType<typeof useStore>;

/** A company's GİB account, as useGIBAccount gives the active one's. */
const accountOf = (store: Store, entity: Entity): GIBAccount => ({
  credentials: () => store.getCredentials(entity.id),
  key: entity.creds.username,
});

const signingToast = (operationId: string) => `mcp-sign-${operationId}`;

const go = (to: '/ayarlar' | '/faturalar' | '/hizmetler' | '/musteriler') =>
  void router.navigate({ to });

/**
 * Runs the built-in MCP server's tools while Angaria › MCP has it on
 * (docs/adr/0009-built-in-mcp-server.md, docs/adr/0010-mcp-agent-actions.md):
 * starts the Rust server with the tool list, runs each `mcp:call` with the
 * active company's store, login and GİB queue, logs it, and sends the result
 * back. What an agent signs, deletes or changes shows as a toast. Mounted
 * outside the license gate, so a locked app still answers with the license
 * error.
 */
export function McpHost() {
  const { allowActions, enabled, port } = useMcpSettings();
  const store = useStore();
  const queryClient = useQueryClient();
  const { status } = useLicense();

  // Calls outlive the render they started in.
  const latest = useRef(store);
  useEffect(() => {
    latest.current = store;
  }, [store]);

  const actions = useRef(allowActions);
  const state = useRef<McpState | null>(null);
  useEffect(() => {
    actions.current = allowActions;
    // Switched off: an SMS approval in progress ends and gives the session back.
    if (!allowActions) {
      state.current?.signing.endAll('cancelled');
    }
  }, [allowActions]);

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

  const onAction = useCallback(
    (action: McpAction, account: GIBAccount, entity: Entity, mcpState: McpState) => {
      const refreshInvoices = () =>
        void queryClient.invalidateQueries({ queryKey: ['invoices', account.key] });
      switch (action.kind) {
        case 'signing-requested':
          toast('Ajan SMS onayı bekliyor', {
            cancel: {
              label: 'Vazgeç',
              onClick: () => mcpState.signing.end(action.operationId, 'cancelled'),
            },
            description: `${entity.name}: ${action.count} taslak için SMS şifresi gönderildi. GİB işlemlerin onay bitene kadar bekler.`,
            duration: Math.max(1000, action.expiresAt - Date.now()),
            id: signingToast(action.operationId),
          });
          return;
        case 'signed': {
          refreshInvoices();
          const [first] = action.invoices;
          toast.success(
            action.invoices.length === 1
              ? 'Ajan faturayı onayladı'
              : `Ajan ${action.invoices.length} faturayı onayladı`,
            {
              action: first
                ? {
                    label: 'Aç',
                    onClick: () =>
                      void router.navigate({
                        params: { ettn: first.uuid },
                        to: '/faturalar/$ettn',
                      }),
                  }
                : undefined,
              description: `${entity.name}: ${action.invoices
                .map((invoice) => invoice.number ?? invoice.uuid)
                .join(', ')}`,
            },
          );
          return;
        }
        case 'draft-deleted':
          refreshInvoices();
          toast.success('Ajan bir taslağı sildi', {
            action: { label: 'Faturalar', onClick: () => go('/faturalar') },
            description: `${entity.name}: ${action.number ?? action.uuid}`,
          });
          return;
        case 'customer-deleted':
          toast.success('Ajan bir müşteriyi sildi', {
            action: { label: 'Müşteriler', onClick: () => go('/musteriler') },
            description: `${entity.name}: ${action.name}`,
          });
          return;
        case 'service-deleted':
          toast.success('Ajan bir hizmeti sildi', {
            action: { label: 'Hizmetler', onClick: () => go('/hizmetler') },
            description: `${entity.name}: ${action.name}`,
          });
          return;
        case 'company-details-updated':
          toast.success('Ajan firma bilgilerini değiştirdi', {
            action: { label: 'Ayarlar', onClick: () => go('/ayarlar') },
            description: `${entity.name}. PDF’ler yeni bilgilerle çıkar.`,
          });
          return;
        case 'gib-session-closed':
          toast.success('Ajan GİB oturumunu kapattı', { description: entity.name });
      }
    },
    [queryClient],
  );

  /**
   * A call's context for one company: its account, records and setters as the
   * call arrived, so a company switch while it waits never mixes two
   * companies' data, and naming another company never switches the app's.
   */
  const contextFor = useCallback(
    function build(store: Store, mcpState: McpState, entityId: string): McpToolContext {
      const entity =
        store.entities.find((candidate) => candidate.id === entityId) ?? store.activeEntity;
      const account = accountOf(store, entity);
      const update = (change: (entity: Entity) => Partial<Entity>) =>
        store.updateEntity(entity.id, (current) => ({ ...current, ...change(current) }));
      const setCustomers = (change: (customers: Array<Recipient>) => Array<Recipient>) =>
        update((current) => ({ savedRecipients: change(current.savedRecipients) }));
      const setServices = (change: (services: Array<Service>) => Array<Service>) =>
        update((current) => ({ savedItems: change(current.savedItems) }));
      return {
        actionsAllowed: () => actions.current,
        client: {
          cancelInvoice,
          createDraftInvoice,
          getDrafts,
          getInvoiceDetail,
          getInvoiceHTML,
          startSMSSign,
          verifyAndSign,
        },
        companies: () =>
          store.entities.map(({ companyInfo, gibIdentity, id, name }) => ({
            active: id === store.activeEntityId,
            gibLogin: store.hasCredentialsFor(id) ? 'ready' : 'needs-login',
            gibTaxID: gibIdentity?.taxID,
            id,
            legalName: companyInfo.name,
            name,
            taxID: companyInfo.taxID,
          })),
        company: () => ({
          companyInfo: entity.companyInfo,
          customers: entity.savedRecipients,
          gibIdentity: entity.gibIdentity,
          hasCredentials: store.hasCredentialsFor(entity.id),
          id: entity.id,
          name: entity.name,
          services: entity.savedItems,
        }),
        forCompany: (ref) => {
          const found = resolveCompany(companyKeys(store.entities), ref);
          return found === null || found === 'ambiguous' ? found : build(store, mcpState, found.id);
        },
        currencyRate: async (currency, date) =>
          (await fetchTCMBRateTable(date)).rates.get(currency),
        // What İndir does on the invoice detail, with the same queries.
        download: async ({ format, invoice, language }) => {
          const { ettn } = invoice;
          const source = {
            company: entity.companyInfo,
            dueDate: dueDateOf(ettn),
            entityName: entity.name,
            invoice,
            readHTML: () =>
              queryClient.fetchQuery(invoiceHTMLQuery(account, ettn, invoice.onayDurumu ?? '')),
          };
          if (format === 'angaria-pdf') {
            const detail = await queryClient.fetchQuery(invoiceDetailQuery(account, ettn));
            return saveAngariaPDF(source, parseGIBInvoice(detail), language);
          }
          return saveEArchive(source, format === 'earsiv-pdf' ? 'pdf' : 'zip', () =>
            gib.run(account, (session) => downloadInvoice(session, ettn, invoice.onayDurumu ?? '')),
          );
        },
        forceLogout: () => gib.forceClose(account),
        // The signal drops a waiting task; a started one runs to its end.
        gib: (task, signal, options) =>
          gib.run(account, (session) => task(session), { ...options, signal }),
        imports: importRuns,
        lease: (signal) => gib.lease(account, { signal }),
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
        onAction: (action) => onAction(action, account, entity, mcpState),
        // What Yeni fatura does after a draft: the list, the due date, the
        // customer and services learned, for the company the draft was made for.
        onDraftCreated: (draft, values) => {
          void queryClient.invalidateQueries({ queryKey: ['invoices', account.key] });
          if (latest.current.activeEntityId === entity.id) {
            latest.current.setInvoiceDateRange((range) => rangeCovering(range, draft.date));
          }
          if (draft.uuid && values.advancedFields.dueDate) {
            saveDueDate(draft.uuid, values.advancedFields.dueDate);
          }
          setServices((saved) =>
            upsertSavedItems(
              saved,
              cleanItems(values.items),
              store.newId,
              values.invoiceSettings.currency,
            ),
          );
          const pdfLanguage = values.recipient.pdfLanguage ?? defaultPDFLanguage(values.recipient);
          setCustomers(
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
            description: `${entity.name}: ${customerName(values.recipient)}. SMS ile onaylamak için aç.`,
          });
        },
        setCompanyInfo: (change) =>
          update((current) => ({ companyInfo: change(current.companyInfo) })),
        setCustomers,
        setServices,
        state: mcpState,
      };
    },
    [onAction, queryClient],
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
    const mcpState = createMcpState({
      onSigningEnd: (operation) => toast.dismiss(signingToast(operation.id)),
    });
    state.current = mcpState;

    async function run({ arguments: args, id, name }: McpToolCall) {
      const controller = new AbortController();
      running.set(id, controller);
      const deadline = setTimeout(() => controller.abort(), QUEUE_DEADLINE_MS);
      try {
        // Loaded with the first call or the server's start, not at launch.
        const { runMcpTool } = await import('@/lib/mcp-tools.ts');
        const { activity, result } = await runMcpTool(
          contextFor(latest.current, mcpState, latest.current.activeEntityId),
          name,
          args,
          controller.signal,
        );
        recordMcpActivity({
          ...activity,
          at: new Date().toISOString(),
          id: `${Date.now()}-${id}`,
          input: activityInput(args),
          tool: name,
        });
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
      // Calls still waiting for GİB answer busy; started ones finish. An SMS
      // approval in progress ends and gives the session back.
      for (const controller of running.values()) {
        controller.abort();
      }
      mcpState.dispose();
      if (state.current === mcpState) {
        state.current = null;
      }
    };
  }, [contextFor, enabled, port]);

  return null;
}
