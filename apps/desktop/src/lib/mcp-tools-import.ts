// Faturalardan içe aktar over MCP (docs/adr/0010-mcp-agent-actions.md): the
// scan runs in the background on the GİB queue, as the dialog's does, and can
// take longer than an MCP call, so scan_gib_import starts it and is called
// again for its progress; apply_gib_import saves the customers and services
// the agent picked, never changing saved ones.
import { z } from 'zod';
import {
  applyImport,
  importCandidates,
  importRange,
  importWeeks,
  IMPORT_PERIODS,
  IMPORT_PACE_MS,
  pause,
  scanInvoices,
  type ImportCandidates,
  type ImportPeriod,
  type ScanClient,
} from './gib-import.ts';
import { dueDateOf } from './invoice-due-dates.ts';
import type { ImportScan } from './mcp-state.ts';
import { defineTool, errorOutput, failure, json, type McpToolContext } from './mcp-tool-kit.ts';
import type { Invoice } from './types.ts';

/** How long one scan_gib_import call waits for the scan before it reports progress. */
export const SCAN_WAIT_MS = 30_000;

const periodInput = z
  .enum(IMPORT_PERIODS.map((period) => period.value) as [ImportPeriod, ...Array<ImportPeriod>])
  .describe("How far back: '3-ay', '6-ay', '1-yil' or '2-yil' (months, years)");

/** The due date Angaria kept for an invoice, when it can read it. */
const keptDueDate = (ettn: string) => {
  try {
    return dueDateOf(ettn);
  } catch {
    return undefined;
  }
};

const scanKey = (companyId: string, period: ImportPeriod) => `${companyId}:${period}`;

function startScan(ctx: McpToolContext, period: ImportPeriod): ImportScan {
  const controller = new AbortController();
  const scan: ImportScan = {
    companyId: ctx.company().id,
    controller,
    id: ctx.state.newId(),
    period,
    progress: null,
    settled: Promise.resolve(),
  };
  // Background tasks: what the user and other calls ask for goes first.
  const client: ScanClient = {
    detail: (ettn, signal) =>
      ctx.gib(
        async (session) => {
          await pause(IMPORT_PACE_MS, signal);
          return ctx.client.getInvoiceDetail(session, ettn);
        },
        signal,
        { background: true },
      ),
    list: (week, signal) =>
      ctx.gib(
        async (session) => {
          await pause(IMPORT_PACE_MS, signal);
          return (await ctx.client.getDrafts(session, week.start, week.end)) as Array<Invoice>;
        },
        signal,
        { background: true },
      ),
  };
  scan.settled = scanInvoices(client, importWeeks(importRange(period, ctx.now())), {
    onProgress: (progress) => {
      scan.progress = progress;
    },
    signal: controller.signal,
  }).then(
    (invoices) => {
      scan.invoices = invoices;
    },
    (error: unknown) => {
      scan.error = error;
    },
  );
  return scan;
}

/** What a finished scan offers, against the company's records now. */
function candidatesOf(ctx: McpToolContext, scan: ImportScan): ImportCandidates {
  const { customers, services } = ctx.company();
  return importCandidates(scan.invoices ?? [], { customers, services });
}

const scanGIBImport = defineTool({
  annotations: { openWorldHint: true, readOnlyHint: true },
  description:
    "Faturalardan içe aktar, step 1: reads the active company's signed (Onaylı) invoices of the period on GİB and returns the customers and services found in them, each with a key and whether it is saved already. A long period takes a while: while it runs this returns status 'scanning' with progress; call it again with the same period until status is 'done'. Then call apply_gib_import with the scanId and the keys to save.",
  gib: true,
  inputSchema: z.object({ period: periodInput.optional() }),
  name: 'scan_gib_import',
  run: async (ctx, { period = '1-yil' }, signal) => {
    const key = scanKey(ctx.company().id, period);
    let scan = ctx.state.scans.get(key);
    // A failed scan starts over on the next call.
    if (!scan || scan.error !== undefined) {
      scan = startScan(ctx, period);
      ctx.state.scans.set(key, scan);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      scan.settled,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, SCAN_WAIT_MS);
        signal?.addEventListener('abort', () => resolve(), { once: true });
      }),
    ]);
    clearTimeout(timer);
    if (scan.error !== undefined) {
      ctx.state.scans.delete(key);
      return errorOutput(scan.error);
    }
    if (!scan.invoices) {
      return json(
        {
          message: 'Faturalar taranıyor. Aynı dönemle tekrar çağır.',
          period,
          progress: scan.progress,
          scanId: scan.id,
          status: 'scanning',
        },
        'Taranıyor',
      );
    }
    const candidates = candidatesOf(ctx, scan);
    return json(
      {
        customers: candidates.customers.map(({ existing, invoiceCount, key: id, name, taxID }) => ({
          invoiceCount,
          key: id,
          name,
          saved: existing,
          taxID,
        })),
        invoices: scan.invoices.length,
        period,
        scanId: scan.id,
        services: candidates.services.map(({ existing, key: id, service }) => ({
          currency: service.currency,
          key: id,
          name: service.name,
          saved: existing,
          unitPrice: service.unitPrice,
          unitType: service.unitType,
          VATRate: service.VATRate,
        })),
        status: 'done',
      },
      `${candidates.customers.length} müşteri, ${candidates.services.length} hizmet bulundu`,
    );
  },
  summarize: ({ period = '1-yil' }) =>
    `Son ${IMPORT_PERIODS.find((item) => item.value === period)?.label ?? period}`,
});

const applyGIBImport = defineTool({
  annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
  description:
    'Faturalardan içe aktar, step 2: saves the customers and services of a finished scan_gib_import whose keys are given. Saved ones are skipped and never changed. A customer learns its details and invoice defaults from its newest invoice, as a new draft teaches them.',
  gib: false,
  inputSchema: z.object({
    customerKeys: z.array(z.string()).optional().describe('Keys of the customers to save'),
    scanId: z.string().min(1).describe('scanId from scan_gib_import'),
    serviceKeys: z.array(z.string()).optional().describe('Keys of the services to save'),
  }),
  name: 'apply_gib_import',
  run: async (ctx, { customerKeys = [], scanId, serviceKeys = [] }) => {
    const scan = [...ctx.state.scans.values()].find((candidate) => candidate.id === scanId);
    if (!scan?.invoices) {
      return failure('Bu tarama yok ya da bitmedi. scan_gib_import ile tara.', {
        code: 'unknown-scan',
      });
    }
    if (scan.companyId !== ctx.company().id) {
      return failure('Bu tarama başka bir şirketin. Seçili şirket için scan_gib_import ile tara.', {
        code: 'other-company',
      });
    }
    const candidates = candidatesOf(ctx, scan);
    const chosen = {
      customers: candidates.customers.filter((item) => customerKeys.includes(item.key)),
      services: candidates.services.filter((item) => serviceKeys.includes(item.key)),
    };
    const saved = ctx.company();
    const result = applyImport(saved, chosen, ctx.newId, keptDueDate);
    const addedCustomers = result.customers.length - saved.customers.length;
    const addedServices = result.services.length - saved.services.length;
    // Added to the records as they are by then; saved ones are never changed.
    ctx.setCustomers(
      (current) =>
        applyImport(
          { customers: current, services: [] },
          { customers: chosen.customers, services: [] },
          ctx.newId,
          keptDueDate,
        ).customers,
    );
    ctx.setServices(
      (current) =>
        applyImport(
          { customers: [], services: current },
          { customers: [], services: chosen.services },
          ctx.newId,
        ).services,
    );
    return json(
      {
        customers: addedCustomers,
        message: `${addedCustomers} müşteri ve ${addedServices} hizmet kaydedildi.`,
        services: addedServices,
      },
      `${addedCustomers} müşteri, ${addedServices} hizmet`,
    );
  },
});

export const IMPORT_TOOLS = [scanGIBImport, applyGIBImport];
