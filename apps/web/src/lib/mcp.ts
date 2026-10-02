import { m } from '../paraglide/messages.js';

/**
 * The tools of the desktop app's built-in MCP server, in its order
 * (apps/desktop/src/lib/mcp-tools.ts). There is no signing tool. A test keeps
 * the names in step with the app.
 */
export const MCP_TOOLS = [
  {
    body: m.mcp_tool_list_invoices_body,
    name: 'list_invoices',
    title: m.mcp_tool_list_invoices_title,
  },
  { body: m.mcp_tool_get_invoice_body, name: 'get_invoice', title: m.mcp_tool_get_invoice_title },
  {
    body: m.mcp_tool_create_invoice_body,
    name: 'create_invoice',
    title: m.mcp_tool_create_invoice_title,
  },
  {
    body: m.mcp_tool_cancel_invoice_body,
    name: 'cancel_invoice',
    title: m.mcp_tool_cancel_invoice_title,
  },
  {
    body: m.mcp_tool_list_customers_body,
    name: 'list_customers',
    title: m.mcp_tool_list_customers_title,
  },
  {
    body: m.mcp_tool_list_services_body,
    name: 'list_services',
    title: m.mcp_tool_list_services_title,
  },
] as const;

export type McpToolName = (typeof MCP_TOOLS)[number]['name'];

export const mcpToolTitle = (name: McpToolName) =>
  MCP_TOOLS.find((tool) => tool.name === name)?.title() ?? name;

/** The stdio bridge inside Angaria once it is in Applications. */
const BRIDGE_PATH = '/Applications/Angaria.app/Contents/MacOS/angaria-mcp';

/** What the app's Komutu kopyala button copies for Claude Code, from Applications. */
export const CLAUDE_CODE_COMMAND = `claude mcp add --scope user angaria -- '${BRIDGE_PATH}'`;
