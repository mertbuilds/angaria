import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../session.ts';

export function registerGetInvoiceHtml(server: McpServer, { client, withSession }: ToolContext) {
  server.registerTool(
    'get_invoice_html',
    {
      annotations: { openWorldHint: true, readOnlyHint: true },
      description:
        'Get the HTML rendering of an invoice for preview or printing. Returns the complete HTML document.',
      inputSchema: {
        onayDurumu: z
          .enum(['Onaylanmadı', 'Onaylandı'])
          .optional()
          .describe("Approval status: 'Onaylanmadı' (draft, default) or 'Onaylandı' (signed)"),
        uuid: z
          .string()
          .min(1)
          .describe('Invoice UUID (ettn) from list_invoices or create_invoice'),
      },
    },
    async ({ onayDurumu = 'Onaylanmadı', uuid }) => {
      const html = await withSession((session) => client.getInvoiceHTML(session, uuid, onayDurumu));
      return { content: [{ text: html, type: 'text' }] };
    },
  );
}
