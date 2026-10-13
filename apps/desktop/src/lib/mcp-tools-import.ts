// Faturalardan içe aktar over MCP (docs/adr/0010-mcp-agent-actions.md): the
// scan is the app's one import run (src/lib/import-run.ts), the dialog's too.
// It can take longer than an MCP call, so scan_gib_import starts it, or joins
// the dialog's run of the same company and period, and is called again for its
// progress; apply_gib_import saves the customers and services the agent
// picked, never changing saved ones.
import { z } from 'zod';
import {
  applyImport,
  importCandidates,
  IMPORT_PERIODS,
  type ImportCandidates,
  type ImportPeriod,
  type ScanClient,
} from './gib-import.ts';
import type { ImportRun } from './import-run.ts';
import { dueDateOf } from './invoice-due-dates.ts';
import type { ImportScan } from './mcp-state.ts';
import { defineTool, errorOutput, failure, json, type McpToolContext } from './mcp-tool-kit.ts';
import type { Invoice } from './types.ts';

/** How long one scan_gib_import call waits for the scan before it reports progress. */
export const SCAN_WAIT_MS = 30_000;

const periodInput = z
  .enum(IMPORT_PERIODS.map((period) => period.value) as [ImportPeriod, ...Array<ImportPeriod>])
  .describe("How far back: '3-ay', '6-ay', '1-yil' or '2-yil' (months, years)");

const periodLabel = (period: ImportPeriod) =>
  IMPORT_PERIODS.find((item) => item.value === period)?.label ?? period;

/** The due date Angaria kept for an invoice, when it can read it. */
const keptDueDate = (ettn: string) => {
  try {
    return dueDateOf(ettn);
  } catch {
    return undefined;
  }
};

/** Background tasks on the company's login: what the user and other calls ask for goes first. */
const scanClient = (ctx: McpToolContext): ScanClient => ({
  detail: (ettn, signal) =>
    ctx.gib((session) => ctx.client.getInvoiceDetail(session, ettn), signal, { background: true }),
  list: (week, signal) =>
    ctx.gib(
      async (session) =>
        (await ctx.client.getDrafts(session, week.start, week.end)) as Array<Invoice>,
      signal,
      { background: true },
    ),
});

/** Another run is scanning: one at a time, so this call does not start a second. */
function otherRunScanning(ctx: McpToolContext, run: ImportRun) {
  const company = ctx.companies().find((item) => item.id === run.companyId)?.name;
  return failure(
    `Angaria’da şu an başka bir içe aktarma sürüyor (${company ? `${company}, ` : ''}son ${periodLabel(run.period)}). Aynı anda tek içe aktarma yapılır: bitmesini bekle ya da Angaria’da durdur, sonra tekrar dene.`,
    {
      code: 'import-running',
      companyId: run.companyId,
      period: run.period,
      progress: run.progress,
    },
  );
}

/** What a finished scan offers, against the company's records now. */
function candidatesOf(ctx: McpToolContext, scan: ImportScan): ImportCandidates {
  const { customers, services } = ctx.company();
  return importCandidates(scan.invoices, { customers, services });
}

const scanGIBImport = defineTool({
  annotations: { openWorldHint: true, readOnlyHint: true },
  description:
    "Faturalardan içe aktar, step 1: reads the active company's signed (Onaylı) invoices of the period on GİB and returns the customers and services found in them, each with a key and whether it is saved already. A long period takes a while: while it runs this returns status 'scanning' with progress; call it again with the same period until status is 'done'. Then call apply_gib_import with the scanId and the keys to save. Angaria runs one import at a time: while another company or period is scanning, this returns code 'import-running'.",
  gib: true,
  inputSchema: z.object({ period: periodInput.optional() }),
  name: 'scan_gib_import',
  run: async (ctx, { period = '1-yil' }, signal) => {
    const companyId = ctx.company().id;
    let run = ctx.imports.current();
    const same = run?.companyId === companyId && run.period === period;
    if (run?.status === 'scanning' && !same) {
      return otherRunScanning(ctx, run);
    }
    if (run && same && run.status === 'failed') {
      // Goes on from where it stopped.
      run = ctx.imports.retry(scanClient(ctx));
    } else if (!run || !same) {
      run = ctx.imports.start(companyId, period, scanClient(ctx)).run;
    }
    const id = run?.id;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      ctx.imports.settled(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, SCAN_WAIT_MS);
        signal?.addEventListener('abort', () => resolve(), { once: true });
      }),
    ]);
    clearTimeout(timer);
    run = ctx.imports.current();
    if (!run || run.id !== id) {
      return failure('İçe aktarma Angaria’da durduruldu. Taramak için tekrar çağır.', {
        code: 'import-stopped',
      });
    }
    if (run.status === 'failed') {
      return errorOutput(run.error);
    }
    if (run.status === 'scanning' || !run.invoices) {
      return json(
        {
          message: run.progress?.wait
            ? `GİB şu an yoğun, Angaria ${run.progress.wait.seconds} saniye bekleyip tekrar deniyor. Aynı dönemle tekrar çağır.`
            : 'Faturalar taranıyor. Aynı dönemle tekrar çağır.',
          period,
          progress: run.progress,
          scanId: run.id,
          status: 'scanning',
        },
        'Taranıyor',
      );
    }
    const scan: ImportScan = { companyId, id: run.id, invoices: run.invoices, period };
    ctx.state.scans.set(scan.id, scan);
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
  summarize: ({ period = '1-yil' }) => `Son ${periodLabel(period)}`,
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
    const scan = ctx.state.scans.get(scanId);
    if (!scan) {
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
    // Saved: the app's run is done with (its pick step would offer the same).
    ctx.imports.cancel(scan.id);
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
