// The app side of MCP in the background (docs/adr/0012-mcp-in-the-background.md):
// Rust keeps the MCP settings in mcp.json, because it needs them before the
// webview loads (the bridge's cold start, the window's close button). The
// webview reads them at launch, saves every change there, and takes the menu
// bar's changes back. The menu bar also lists the agents' newest calls and
// opens screens.
import { toast } from '@angaria/ui';
import { isTauri } from '@tauri-apps/api/core';
import { errorMessage } from './gib-errors.ts';
import {
  mcpSetSettings,
  mcpSettings,
  onAppNavigate,
  onMcpSettings,
  traySetActivity,
} from './mcp-native.ts';
import {
  getMcpActivity,
  menuBarActivity,
  onMcpSettingsChange,
  readMcpSettings,
  replaceMcpSettings,
  subscribeMcp,
  toMcpSettings,
  type McpSettings,
} from './mcp.ts';

/** The screens a menu bar item opens (src-tauri/src/tray.rs). */
export const MENU_BAR_ROUTES = ['/mcp', '/yeni'] as const;
export type MenuBarRoute = (typeof MENU_BAR_ROUTES)[number];

const isMenuBarRoute = (route: string): route is MenuBarRoute =>
  (MENU_BAR_ROUTES as ReadonlyArray<string>).includes(route);

/**
 * The settings the app starts with: Rust's, or on the first launch after
 * 0012, the ones this webview kept in localStorage, which then go to Rust.
 */
export function startingSettings(
  saved: unknown,
  local: McpSettings,
): { save: boolean; settings: McpSettings } {
  return saved === null || saved === undefined
    ? { save: true, settings: local }
    : { save: false, settings: toMcpSettings(saved) };
}

/** How long a failed first save waits before it goes again, once the app shows. */
export const FIRST_SAVE_RETRY_MS = 1000;

const save = (settings: McpSettings) =>
  void mcpSetSettings(settings).catch((error: unknown) =>
    toast.error('MCP ayarı kaydedilemedi', { description: errorMessage(error) }),
  );

/** Before the first render: the settings from Rust, then both kept in step. */
export async function connectMenuBar(navigate: (route: MenuBarRoute) => void) {
  if (!isTauri()) {
    return;
  }
  try {
    const { save: first, settings } = startingSettings(await mcpSettings(), readMcpSettings());
    replaceMcpSettings(settings);
    if (first) {
      // Until Rust has them, the tray says MCP is off and closing quits: try
      // again after the first render, where a second failure shows a toast.
      await mcpSetSettings(settings).catch(() => {
        setTimeout(() => save(readMcpSettings()), FIRST_SAVE_RETRY_MS);
      });
    }
  } catch {
    // Rust could not read mcp.json: the webview's copy, saved on the next change.
  }
  onMcpSettingsChange(save);
  void onMcpSettings((settings) => replaceMcpSettings(toMcpSettings(settings)));
  void onAppNavigate((route) => {
    if (isMenuBarRoute(route)) {
      navigate(route);
    }
  });

  let sent: unknown = null;
  const sendActivity = () => {
    const activity = getMcpActivity();
    if (activity !== sent) {
      sent = activity;
      void traySetActivity(menuBarActivity(activity)).catch(() => {});
    }
  };
  subscribeMcp(sendActivity);
  sendActivity();
}
