import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withSession } from "../session.ts";
import { createDraftInvoice } from "../angaria-sdk.ts";
import { computeItemFields, computeTotals } from "../totals.ts";

function todayGIB(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function nowTime(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mi}:${ss}`;
}

const ItemSchema = z.object({
  name: z.string().describe("Product or service name"),
  quantity: z.number().positive().describe("Quantity"),
  unitPrice: z.number().nonnegative().describe("Unit price excluding VAT"),
  VATRate: z.number().min(0).max(100).describe("VAT rate as percentage (0, 1, 10, or 20)"),
  unitType: z
    .string()
    .optional()
    .describe("Unit code: 'C62' (piece, default), 'HUR' (hour), 'DAY' (day), 'MON' (month)"),
  discountRate: z.number().min(0).max(100).optional().describe("Discount rate as percentage"),
  discountAmount: z.number().nonnegative().optional().describe("Discount amount in currency units"),
  discountReason: z.string().optional().describe("Reason for discount"),
  gtip: z.string().optional().describe("Customs tariff code (GTIP), for goods export invoices"),
});

export function registerCreateInvoice(server: McpServer): void {
  server.tool(
    "create_invoice",
    "Create a draft e-archive invoice on the GIB portal. Computed fields (line totals, VAT amounts, grand totals) are calculated automatically — only provide item name, quantity, unitPrice, and VATRate. Returns the invoice UUID.",
    {
      taxIDOrTRID: z
        .string()
        .describe("Recipient tax ID (VKN, 10 digits) or TR ID (TCKN, 11 digits)"),
      title: z.string().describe("Recipient company name or full name"),
      fullAddress: z.string().describe("Recipient full address"),
      items: z.array(ItemSchema).min(1).describe("Invoice line items (at least one)"),
      date: z.string().optional().describe("Invoice date DD/MM/YYYY. Defaults to today."),
      time: z.string().optional().describe("Invoice time HH:MM:SS. Defaults to now."),
      invoiceType: z
        .string()
        .optional()
        .describe(
          "Invoice type: ISTISNA (default, for exports), SATIS, IADE, TEVKIFAT, OZELMATRAH, IHRACKAYITLI",
        ),
      currency: z.string().optional().describe("Currency code: USD (default), TRY, EUR, GBP, etc."),
      currencyRate: z
        .string()
        .optional()
        .describe("Exchange rate to TRY. Required when currency is not TRY."),
      name: z.string().optional().describe("Recipient first name (for individuals)"),
      surname: z.string().optional().describe("Recipient last name (for individuals)"),
      taxOffice: z.string().optional().describe("Tax office name (vergi dairesi)"),
      country: z.string().optional().describe("Country name in Turkish"),
      city: z.string().optional().describe("City"),
      district: z.string().optional().describe("District"),
      note: z.string().optional().describe("Note to appear on the invoice"),
    },
    async (args) => {
      try {
        const computedItems = args.items.map(computeItemFields);
        const totals = computeTotals(computedItems);

        const result = await withSession((s) =>
          createDraftInvoice(s, {
            date: args.date ?? todayGIB(),
            time: args.time ?? nowTime(),
            currency: args.currency ?? "USD",
            currencyRate: args.currencyRate,
            invoiceType: args.invoiceType ?? "ISTISNA",
            taxIDOrTRID: args.taxIDOrTRID,
            title: args.title,
            name: args.name,
            surname: args.surname,
            fullAddress: args.fullAddress,
            country: args.country,
            city: args.city,
            district: args.district,
            taxOffice: args.taxOffice,
            items: computedItems,
            note: args.note,
            ...totals,
          }),
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                uuid: result.uuid,
                date: result.date,
                message: "Invoice created successfully",
              }),
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Failed to create invoice: ${msg}` }],
          isError: true,
        };
      }
    },
  );
}
