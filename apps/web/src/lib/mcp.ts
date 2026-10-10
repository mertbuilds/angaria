import { m } from '../paraglide/messages.js';

/**
 * The tools of the desktop app's built-in MCP server, in its order
 * (apps/desktop/src/lib/mcp.ts). A gated tool works only while the app's
 * Ajanlar onaylayabilir ve silebilir switch is on. A test keeps the names and
 * the gates in step with the app.
 */
export const MCP_TOOLS = [
  {
    body: m.mcp_tool_list_invoices_body,
    name: 'list_invoices',
    title: m.mcp_tool_list_invoices_title,
  },
  {
    body: m.mcp_tool_get_invoice_body,
    name: 'get_invoice',
    title: m.mcp_tool_get_invoice_title,
  },
  {
    body: m.mcp_tool_create_invoice_body,
    name: 'create_invoice',
    title: m.mcp_tool_create_invoice_title,
  },
  {
    body: m.mcp_tool_duplicate_invoice_body,
    name: 'duplicate_invoice',
    title: m.mcp_tool_duplicate_invoice_title,
  },
  {
    body: m.mcp_tool_download_invoice_body,
    name: 'download_invoice',
    title: m.mcp_tool_download_invoice_title,
  },
  {
    body: m.mcp_tool_request_signing_sms_body,
    gated: true,
    name: 'request_signing_sms',
    title: m.mcp_tool_request_signing_sms_title,
  },
  {
    body: m.mcp_tool_sign_invoices_body,
    gated: true,
    name: 'sign_invoices',
    title: m.mcp_tool_sign_invoices_title,
  },
  {
    body: m.mcp_tool_delete_draft_body,
    gated: true,
    name: 'delete_draft',
    title: m.mcp_tool_delete_draft_title,
  },
  {
    body: m.mcp_tool_list_customers_body,
    name: 'list_customers',
    title: m.mcp_tool_list_customers_title,
  },
  {
    body: m.mcp_tool_get_customer_body,
    name: 'get_customer',
    title: m.mcp_tool_get_customer_title,
  },
  {
    body: m.mcp_tool_create_customer_body,
    name: 'create_customer',
    title: m.mcp_tool_create_customer_title,
  },
  {
    body: m.mcp_tool_update_customer_body,
    name: 'update_customer',
    title: m.mcp_tool_update_customer_title,
  },
  {
    body: m.mcp_tool_delete_customer_body,
    gated: true,
    name: 'delete_customer',
    title: m.mcp_tool_delete_customer_title,
  },
  {
    body: m.mcp_tool_list_services_body,
    name: 'list_services',
    title: m.mcp_tool_list_services_title,
  },
  {
    body: m.mcp_tool_get_service_body,
    name: 'get_service',
    title: m.mcp_tool_get_service_title,
  },
  {
    body: m.mcp_tool_create_service_body,
    name: 'create_service',
    title: m.mcp_tool_create_service_title,
  },
  {
    body: m.mcp_tool_update_service_body,
    name: 'update_service',
    title: m.mcp_tool_update_service_title,
  },
  {
    body: m.mcp_tool_delete_service_body,
    gated: true,
    name: 'delete_service',
    title: m.mcp_tool_delete_service_title,
  },
  {
    body: m.mcp_tool_list_companies_body,
    name: 'list_companies',
    title: m.mcp_tool_list_companies_title,
  },
  {
    body: m.mcp_tool_get_company_details_body,
    name: 'get_company_details',
    title: m.mcp_tool_get_company_details_title,
  },
  {
    body: m.mcp_tool_update_company_details_body,
    gated: true,
    name: 'update_company_details',
    title: m.mcp_tool_update_company_details_title,
  },
  {
    body: m.mcp_tool_get_exchange_rate_body,
    name: 'get_exchange_rate',
    title: m.mcp_tool_get_exchange_rate_title,
  },
  {
    body: m.mcp_tool_check_gib_connection_body,
    name: 'check_gib_connection',
    title: m.mcp_tool_check_gib_connection_title,
  },
  {
    body: m.mcp_tool_close_gib_session_body,
    gated: true,
    name: 'close_gib_session',
    title: m.mcp_tool_close_gib_session_title,
  },
  {
    body: m.mcp_tool_scan_gib_import_body,
    name: 'scan_gib_import',
    title: m.mcp_tool_scan_gib_import_title,
  },
  {
    body: m.mcp_tool_apply_gib_import_body,
    name: 'apply_gib_import',
    title: m.mcp_tool_apply_gib_import_title,
  },
] as const;

export type McpToolName = (typeof MCP_TOOLS)[number]['name'];

export const mcpToolTitle = (name: McpToolName) =>
  MCP_TOOLS.find((tool) => tool.name === name)?.title() ?? name;

/** The stdio bridge inside Angaria once it is in Applications. */
const BRIDGE_PATH = '/Applications/Angaria.app/Contents/MacOS/angaria-mcp';

/** What the app's Komutu kopyala button copies for Claude Code, from Applications. */
export const CLAUDE_CODE_COMMAND = `claude mcp add --scope user angaria -- '${BRIDGE_PATH}'`;
