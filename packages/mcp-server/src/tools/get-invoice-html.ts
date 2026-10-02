import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { invoiceUUID } from '../inputs.ts';
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
        uuid: invoiceUUID,
      },
    },
    async ({ onayDurumu = 'Onaylanmadı', uuid }) =>
      withSession(async (session) => ({
        content: [{ text: await client.getInvoiceHTML(session, uuid, onayDurumu), type: 'text' }],
      })),
  );
}
