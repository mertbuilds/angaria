import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { draftSearchRange, gibDate } from '../dates.ts';
import type { ToolContext } from '../session.ts';

export function registerCancelInvoice(server: McpServer, { client, withSession }: ToolContext) {
  server.registerTool(
    'cancel_invoice',
    {
      annotations: { destructiveHint: true, openWorldHint: true },
      description:
        'Cancel (delete) a draft invoice on the GİB portal. Only works on unsigned draft invoices. Provide the invoice UUID from list_invoices or create_invoice.',
      inputSchema: {
        date: gibDate
          .optional()
          .describe(
            'Invoice date DD/MM/YYYY to narrow the search. If omitted, searches the last 90 days.',
          ),
        reason: z.string().min(1).describe("Cancellation reason (e.g. 'Hatalı düzenlendi')"),
        uuid: z
          .string()
          .min(1)
          .describe('Invoice UUID (ettn) from list_invoices or create_invoice'),
      },
    },
    async ({ date, reason, uuid }) => {
      const { endDate, startDate } = draftSearchRange(date, new Date());

      const result = await withSession(async (session) => {
        const drafts = (await client.getDrafts(session, startDate, endDate)) as Array<
          Record<string, unknown>
        >;
        const invoice = drafts.find((d) => d.ettn === uuid || d.faturaUuid === uuid);

        if (!invoice) {
          throw new Error(
            `Invoice with UUID ${uuid} not found in date range ${startDate} - ${endDate}. ` +
              'Use list_invoices to verify the UUID exists and the invoice is in draft state.',
          );
        }
        if (invoice.onayDurumu !== 'Onaylanmadı') {
          throw new Error(
            `Invoice ${uuid} is not an unsigned draft (onayDurumu: ${String(invoice.onayDurumu)}). ` +
              'Only unsigned drafts can be cancelled.',
          );
        }

        return client.cancelInvoice(session, reason, invoice);
      });

      return {
        content: [
          {
            text: JSON.stringify({
              message: 'Invoice cancelled successfully',
              result,
              success: true,
              uuid,
            }),
            type: 'text',
          },
        ],
      };
    },
  );
}
