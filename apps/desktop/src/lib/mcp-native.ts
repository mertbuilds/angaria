// The built-in MCP server's Tauri commands and events (src-tauri/src/mcp).
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { McpToolResult } from './mcp-tools.ts';
import type { McpMenuBarActivity, McpSettings } from './mcp.ts';

export interface McpClientSeen {
  /** ms since the epoch */
  lastSeen: number;
  name: string;
  version: string;
}

export interface McpStatus {
  bridgeFound: boolean;
  /** Where the angaria-mcp bridge is, for the client configs */
  bridgePath: string;
  clients: Array<McpClientSeen>;
  port: number | null;
  running: boolean;
}

/** An MCP client Angaria can add itself to (src-tauri/src/mcp/agents). */
export interface McpAgent {
  configPath: string;
  /** Why its config could not be read */
  error: string | null;
  id: string;
  /** The client looks installed on this Mac */
  installed: boolean;
  name: string;
  /** Its config already has an "angaria" server */
  ourServerInstalled: boolean;
}

export interface McpAgentResult {
  /** The file was written; false when it already was as asked */
  changed: boolean;
  error: string | null;
  id: string;
  path: string;
  success: boolean;
}

export interface McpToolCall {
  arguments: unknown;
  id: number;
  name: string;
}

export const mcpStart = (port: number, tools: ReadonlyArray<unknown>) =>
  invoke<McpStatus>('mcp_start', { port, tools });
export const mcpStop = () => invoke<void>('mcp_stop');
export const mcpStatus = () => invoke<McpStatus>('mcp_status');
export const mcpRespond = (id: number, result: McpToolResult) =>
  invoke<void>('mcp_respond', { id, result });
export const mcpToken = () => invoke<string>('mcp_token');
export const mcpRotateToken = () => invoke<string>('mcp_rotate_token');
/** The settings Rust keeps in mcp.json; null before the webview first saved them. */
export const mcpSettings = () => invoke<McpSettings | null>('mcp_settings');
export const mcpSetSettings = (settings: McpSettings) =>
  invoke<void>('mcp_set_settings', { settings });
export const traySetActivity = (entries: ReadonlyArray<McpMenuBarActivity>) =>
  invoke<void>('tray_set_activity', { entries });
export const mcpAgents = () => invoke<Array<McpAgent>>('mcp_agents');
export const mcpAgentsAdd = (ids: ReadonlyArray<string>) =>
  invoke<Array<McpAgentResult>>('mcp_agents_add', { ids });
export const mcpAgentsRemove = (ids: ReadonlyArray<string>) =>
  invoke<Array<McpAgentResult>>('mcp_agents_remove', { ids });

/** Calls the server hands to the webview; resolves to the unlisten function. */
export const onMcpCall = (handler: (call: McpToolCall) => void) =>
  listen<McpToolCall>('mcp:call', (event) => handler(event.payload));

/** The settings after the menu bar changed them. */
export const onMcpSettings = (handler: (settings: unknown) => void) =>
  listen<unknown>('mcp:settings', (event) => handler(event.payload));

/** A menu bar item opened the window on a screen. */
export const onAppNavigate = (handler: (route: string) => void) =>
  listen<string>('app:navigate', (event) => handler(event.payload));

/** Calls the server stopped waiting for. */
export const onMcpCancel = (handler: (id: number) => void) =>
  listen<number>('mcp:cancel', (event) => handler(event.payload));
