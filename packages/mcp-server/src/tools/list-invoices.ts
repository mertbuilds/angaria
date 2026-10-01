import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { gibDate } from '../dates.ts';
import type { ToolContext } from '../session.ts';

export function registerListInvoices(server: McpServer, { client, withSession }: ToolContext) {
  server.registerTool(
    'list_invoices',
    {
      annotations: { openWorldHint: true, readOnlyHint: true },
      description:
        'List e-Arşiv invoices on the GİB portal for a date range. Each record has the ETTN (uuid), document number, date, recipient, and approval status (Onaylanmadı = unsigned draft, Onaylandı = signed).',
      inputSchema: {
        endDate: gibDate.describe("End date in DD/MM/YYYY format (e.g. '20/03/2026')"),
        startDate: gibDate.describe("Start date in DD/MM/YYYY format (e.g. '01/03/2026')"),
      },
    },
    async ({ endDate, startDate }) => {
      const drafts = await withSession((session) => client.getDrafts(session, startDate, endDate));
      return { content: [{ text: JSON.stringify(drafts, null, 2), type: 'text' }] };
    },
  );
}
