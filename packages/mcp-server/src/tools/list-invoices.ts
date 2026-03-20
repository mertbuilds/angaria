import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withSession } from "../session.ts";
import { getDrafts } from "../angaria-sdk.ts";

export function registerListInvoices(server: McpServer): void {
  server.tool(
    "list_invoices",
    "List draft e-archive invoices from GIB portal for a date range. Returns invoice records including UUID, date, recipient, amounts, and approval status.",
    {
      startDate: z.string().describe("Start date in DD/MM/YYYY format (e.g. '01/03/2026')"),
      endDate: z.string().describe("End date in DD/MM/YYYY format (e.g. '20/03/2026')"),
    },
    async ({ startDate, endDate }) => {
      try {
        const drafts = await withSession((s) => getDrafts(s, startDate, endDate));
        return { content: [{ type: "text" as const, text: JSON.stringify(drafts, null, 2) }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Failed to list invoices: ${msg}` }],
          isError: true,
        };
      }
    },
  );
}
