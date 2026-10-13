import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { cancelInvoiceTool, draftSearchRange, findDraftToCancel } from '../inputs.ts';
import type { ToolContext } from '../session.ts';

export function registerCancelInvoice(server: McpServer, { client, withSession }: ToolContext) {
  const { annotations, description, inputSchema, name } = cancelInvoiceTool;
  server.registerTool(
    name,
    { annotations, description, inputSchema },
    async ({ date, reason, uuid }) => {
      const { endDate, startDate } = draftSearchRange(date, new Date());

      return withSession(async (session) => {
        const drafts = await client.getDrafts(session, startDate, endDate);
        const found = findDraftToCancel(drafts, uuid);

        if (found.kind === 'missing') {
          throw new Error(
            `Invoice with UUID ${uuid} not found in date range ${startDate} - ${endDate}. ` +
              'Use list_invoices to verify the UUID exists and the invoice is in draft state.',
          );
        }
        if (found.kind === 'signed') {
          throw new Error(
            `Invoice ${uuid} is not an unsigned draft (onayDurumu: ${found.status}). ` +
              'Only unsigned drafts can be cancelled.',
          );
        }

        const result = await client.cancelInvoice(session, reason, found.invoice);
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
      });
    },
  );
}
