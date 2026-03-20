import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withSession } from "../session.ts";
import { getDrafts, cancelInvoice } from "../angaria-sdk.ts";

function todayGIB(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function daysAgoGIB(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function registerCancelInvoice(server: McpServer): void {
  server.tool(
    "cancel_invoice",
    "Cancel (delete) a draft invoice from the GIB portal. Only works on unsigned draft invoices. Provide the invoice UUID from list_invoices or create_invoice.",
    {
      uuid: z.string().describe("Invoice UUID (ettn) from list_invoices or create_invoice"),
      reason: z.string().describe("Cancellation reason (e.g. 'Hatalı düzenlendi')"),
      date: z
        .string()
        .optional()
        .describe(
          "Invoice date DD/MM/YYYY to narrow search. If omitted, searches the last 90 days.",
        ),
    },
    async ({ uuid, reason, date }) => {
      try {
        const result = await withSession(async (session) => {
          // Build search date range
          let startDate: string;
          let endDate: string;
          if (date) {
            // Parse DD/MM/YYYY and search ±7 days
            const [dd, mm, yyyy] = date.split("/").map(Number);
            const d = new Date(yyyy!, mm! - 1, dd);
            d.setDate(d.getDate() - 7);
            startDate = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
            const e = new Date(yyyy!, mm! - 1, dd!);
            e.setDate(e.getDate() + 7);
            endDate = `${String(e.getDate()).padStart(2, "0")}/${String(e.getMonth() + 1).padStart(2, "0")}/${e.getFullYear()}`;
          } else {
            startDate = daysAgoGIB(90);
            endDate = todayGIB();
          }

          const drafts = await getDrafts(session, startDate, endDate);
          const invoice = (drafts as Record<string, unknown>[]).find(
            (d) => d.ettn === uuid || d.faturaUuid === uuid,
          );

          if (!invoice) {
            throw new Error(
              `Invoice with UUID ${uuid} not found in date range ${startDate} - ${endDate}. ` +
                "Use list_invoices to verify the UUID exists and the invoice is in draft state.",
            );
          }

          return cancelInvoice(session, reason, invoice);
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                uuid,
                message: "Invoice cancelled successfully",
                result,
              }),
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Failed to cancel invoice: ${msg}` }],
          isError: true,
        };
      }
    },
  );
}
