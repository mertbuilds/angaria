import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listInvoicesTool } from '../inputs.ts';
import type { ToolContext } from '../session.ts';

export function registerListInvoices(server: McpServer, { client, withSession }: ToolContext) {
  const { annotations, description, inputSchema, name } = listInvoicesTool;
  server.registerTool(
    name,
    { annotations, description, inputSchema },
    async ({ endDate, startDate }) =>
      withSession(async (session) => {
        const drafts = await client.getDrafts(session, startDate, endDate);
        return { content: [{ text: JSON.stringify(drafts, null, 2), type: 'text' }] };
      }),
  );
}
