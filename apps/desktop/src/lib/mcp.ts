// The built-in MCP server's switch, port and in-memory call log, and the setup
// snippets the MCP page copies. The server runs in Rust (src-tauri/src/mcp),
// the tools in the webview (mcp-tools.ts, wired by src/shell/mcp-host.tsx).
// No Tauri imports, so tests can use it directly.
import { useSyncExternalStore } from 'react';

export const MCP_DEFAULT_PORT = 41_234;
const SETTINGS_STORAGE_KEY = 'angaria-mcp';
/** The call log keeps this many entries, newest first. */
const LOG_SIZE = 50;

export interface McpSettings {
  enabled: boolean;
  port: number;
}

type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

const DEFAULT_SETTINGS: McpSettings = { enabled: false, port: MCP_DEFAULT_PORT };

export const isValidPort = (port: number) =>
  Number.isInteger(port) && port >= 1024 && port <= 65_535;

/** The saved settings; off on port 41234 until changed. */
export function readMcpSettings(storage?: SettingsStorage): McpSettings {
  try {
    const stored: unknown = JSON.parse(
      (storage ?? localStorage).getItem(SETTINGS_STORAGE_KEY) ?? '',
    );
    if (typeof stored !== 'object' || stored === null) {
      return DEFAULT_SETTINGS;
    }
    const { enabled, port } = stored as Partial<McpSettings>;
    return {
      enabled: enabled === true,
      port: typeof port === 'number' && isValidPort(port) ? port : MCP_DEFAULT_PORT,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** A tool call as the MCP page lists it: no arguments, no invoice data. */
export interface McpCall {
  at: Date;
  id: number;
  ok: boolean;
  tool: string;
}

export type McpServerState =
  | { kind: 'failed'; message: string }
  | { kind: 'off' }
  | { kind: 'running'; port: number }
  | { kind: 'starting' };

// Read on first use, not on import.
let settings: McpSettings | null = null;
const currentSettings = () => (settings ??= readMcpSettings());
let serverState: McpServerState = { kind: 'off' };
let calls: ReadonlyArray<McpCall> = [];
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setMcpSettings(next: Partial<McpSettings>, storage?: SettingsStorage) {
  settings = { ...currentSettings(), ...next };
  try {
    (storage ?? localStorage).setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // No storage: the choice lasts until the app quits.
  }
  notify();
}

export function setMcpServerState(state: McpServerState) {
  serverState = state;
  notify();
}

export function recordMcpCall(call: McpCall) {
  calls = [call, ...calls].slice(0, LOG_SIZE);
  notify();
}

export const useMcpSettings = () => useSyncExternalStore(subscribe, currentSettings);
export const useMcpServerState = () => useSyncExternalStore(subscribe, () => serverState);
export const useMcpCalls = () => useSyncExternalStore(subscribe, () => calls);

/** The tools as the MCP page names them; mcp-tools.ts gives clients the same titles. */
export const MCP_TOOL_COPY = {
  list_invoices: {
    description: 'İki tarih arasındaki faturaları, en fazla 31 gün',
    title: 'Faturaları listele',
  },
  get_invoice: {
    description: 'Bir faturanın alıcısı, satırları ve tutarları ya da GİB görünümü',
    title: 'Faturayı getir',
  },
  create_invoice: {
    description: 'İmzasız taslak oluşturur. Onayı sen SMS ile verirsin.',
    title: 'Taslak oluştur',
  },
  cancel_invoice: {
    description: 'İmzasız bir taslağı siler. Onaylı faturalara dokunmaz.',
    title: 'Taslağı sil',
  },
  list_customers: {
    description: 'Kayıtlı müşteriler ve fatura varsayılanları',
    title: 'Müşterileri listele',
  },
  list_services: {
    description: 'Kayıtlı hizmetler, fiyatları ve KDV oranları',
    title: 'Hizmetleri listele',
  },
} as const satisfies Record<string, { description: string; title: string }>;

export type McpToolName = keyof typeof MCP_TOOL_COPY;

export const mcpToolTitle = (name: string) => MCP_TOOL_COPY[name as McpToolName]?.title ?? name;

/** A path or text as one single-quoted shell word. */
export const shellQuote = (text: string) => `'${text.replaceAll("'", String.raw`'\''`)}'`;

export const mcpURL = (port: number) => `http://127.0.0.1:${port}/mcp`;

/** Adds the bridge to Claude Code for every project of this user. */
export const claudeCodeCommand = (bridgePath: string) =>
  `claude mcp add --scope user angaria -- ${shellQuote(bridgePath)}`;

/** The Streamable HTTP variant: its header carries the token. */
export const claudeCodeHTTPCommand = (port: number, token: string) =>
  `claude mcp add --scope user --transport http angaria ${mcpURL(port)} --header ${shellQuote(`Authorization: Bearer ${token}`)}`;

/** The mcpServers entry most MCP clients take. */
export const mcpServersJSON = (bridgePath: string) =>
  JSON.stringify({ mcpServers: { angaria: { args: [], command: bridgePath } } }, null, 2);

/**
 * Why a client should not be pointed at the bridge where it is now: macOS
 * runs an app opened from Downloads from a random read-only copy (App
 * Translocation), and a disk image goes away once ejected.
 */
export function bridgeLocationProblem(bridgePath: string): 'translocated' | 'volume' | null {
  if (bridgePath.includes('/AppTranslocation/')) {
    return 'translocated';
  }
  return bridgePath.startsWith('/Volumes/') ? 'volume' : null;
}
