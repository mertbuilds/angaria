import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withSession } from "../session.ts";
import { getInvoiceHTML } from "../angaria-sdk.ts";

export function registerGetInvoiceHtml(server: McpServer): void {
  server.tool(
    "get_invoice_html",
    "Get the HTML rendering of an invoice for preview or printing. Returns the complete HTML document.",
    {
      uuid: z.string().describe("Invoice UUID (ettn) from list_invoices or create_invoice"),
      onayDurumu: z
        .string()
        .optional()
        .describe("Approval status: 'Onaylanmadı' (draft, default) or 'Onaylandı' (signed)"),
    },
    async ({ uuid, onayDurumu }) => {
      try {
        const html = await withSession((s) => getInvoiceHTML(s, uuid, onayDurumu ?? "Onaylanmadı"));
        return { content: [{ type: "text" as const, text: html }] };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Failed to get invoice HTML: ${msg}` }],
          isError: true,
        };
      }
    },
  );
}
