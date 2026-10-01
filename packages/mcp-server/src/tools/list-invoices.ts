import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { gibDate, rangeDays } from '../dates.ts';
import type { ToolContext } from '../session.ts';

const MAX_RANGE_DAYS = 31;

const listInvoicesInput = z
  .object({
    endDate: gibDate.describe("End date in DD/MM/YYYY format (e.g. '20/03/2026')"),
    startDate: gibDate.describe("Start date in DD/MM/YYYY format (e.g. '01/03/2026')"),
  })
  .refine(({ endDate, startDate }) => rangeDays(startDate, endDate) >= 1, {
    message: 'startDate must not be after endDate',
    path: ['startDate'],
  })
  .refine(({ endDate, startDate }) => rangeDays(startDate, endDate) <= MAX_RANGE_DAYS, {
    message: `The range may cover at most ${MAX_RANGE_DAYS} days, both ends included`,
    path: ['endDate'],
  });

export function registerListInvoices(server: McpServer, { client, withSession }: ToolContext) {
  server.registerTool(
    'list_invoices',
    {
      annotations: { openWorldHint: true, readOnlyHint: true },
      description:
        'List e-Arşiv invoices on the GİB portal for a date range of at most 31 days. Each record has the ETTN (uuid), document number, date, recipient, and approval status (Onaylanmadı = unsigned draft, Onaylandı = signed).',
      inputSchema: listInvoicesInput,
    },
    async ({ endDate, startDate }) =>
      withSession(async (session) => {
        const drafts = await client.getDrafts(session, startDate, endDate);
        return { content: [{ text: JSON.stringify(drafts, null, 2), type: 'text' }] };
      }),
  );
}
