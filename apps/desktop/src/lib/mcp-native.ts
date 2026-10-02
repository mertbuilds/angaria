// The built-in MCP server's Tauri commands and events (src-tauri/src/mcp).
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { McpToolResult } from './mcp-tools.ts';

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

export interface McpInstalled {
  backup: string | null;
  path: string;
  /** The config already had Angaria: nothing was written */
  unchanged: boolean;
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
export const mcpInstall = (client: 'claude-desktop' | 'cursor') =>
  invoke<McpInstalled>('mcp_install', { client });

/** Calls the server hands to the webview; resolves to the unlisten function. */
export const onMcpCall = (handler: (call: McpToolCall) => void) =>
  listen<McpToolCall>('mcp:call', (event) => handler(event.payload));

/** Calls the server stopped waiting for. */
export const onMcpCancel = (handler: (id: number) => void) =>
  listen<number>('mcp:cancel', (event) => handler(event.payload));
