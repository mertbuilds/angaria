import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListInvoices } from "./tools/list-invoices.ts";
import { registerCreateInvoice } from "./tools/create-invoice.ts";
import { registerCancelInvoice } from "./tools/cancel-invoice.ts";
import { registerGetInvoiceHtml } from "./tools/get-invoice-html.ts";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "vinena-mcp",
    version: "0.1.0",
  });

  registerListInvoices(server);
  registerCreateInvoice(server);
  registerCancelInvoice(server);
  registerGetInvoiceHtml(server);

  return server;
}
