// The built-in MCP server's switches, port and activity log, and the setup
// snippets the MCP page copies. The server runs in Rust (src-tauri/src/mcp),
// the tools in the webview (mcp-tools.ts, wired by src/shell/mcp-host.tsx).
// In the app the settings live in Rust, which needs them before the webview
// loads (docs/adr/0012-mcp-in-the-background.md); menu-bar.ts connects the
// two. No Tauri imports, so tests can use it directly.
import { useSyncExternalStore } from 'react';

export const MCP_DEFAULT_PORT = 41_234;
const SETTINGS_STORAGE_KEY = 'angaria-mcp';
const ACTIVITY_STORAGE_KEY = 'angaria-mcp-activity';
/** The activity log keeps this many entries, newest first. */
export const ACTIVITY_SIZE = 200;

export interface McpSettings {
  /** Agents may sign, delete and change company details (docs/adr/0010-mcp-agent-actions.md). */
  allowActions: boolean;
  enabled: boolean;
  port: number;
  /** The menu bar icon; MCP works without it. */
  showInMenuBar: boolean;
}

type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

const DEFAULT_SETTINGS: McpSettings = {
  allowActions: false,
  enabled: false,
  port: MCP_DEFAULT_PORT,
  showInMenuBar: true,
};

const isValidPort = (port: number) => Number.isInteger(port) && port >= 1024 && port <= 65_535;

/** Settings as saved, by this or an older version: what it cannot read takes the default. */
export function toMcpSettings(stored: unknown): McpSettings {
  if (typeof stored !== 'object' || stored === null) {
    return DEFAULT_SETTINGS;
  }
  const { allowActions, enabled, port, showInMenuBar } = stored as Partial<McpSettings>;
  return {
    allowActions: allowActions === true,
    enabled: enabled === true,
    port: typeof port === 'number' && isValidPort(port) ? port : MCP_DEFAULT_PORT,
    showInMenuBar: showInMenuBar !== false,
  };
}

/**
 * The settings saved in localStorage; off on port 41234, agent actions off,
 * the menu bar icon on, until changed. In the app, Rust's copy wins.
 */
export function readMcpSettings(storage?: SettingsStorage): McpSettings {
  try {
    return toMcpSettings(JSON.parse((storage ?? localStorage).getItem(SETTINGS_STORAGE_KEY) ?? ''));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const sameSettings = (a: McpSettings, b: McpSettings) =>
  a.allowActions === b.allowActions &&
  a.enabled === b.enabled &&
  a.port === b.port &&
  a.showInMenuBar === b.showInMenuBar;

/**
 * A tool call as the MCP page lists it. The summary and result are the tool's
 * own short Turkish lines; the input is the arguments with SMS codes,
 * passwords and tokens masked (mcp-activity-input.ts).
 */
export interface McpActivity {
  /** ISO 8601 */
  at: string;
  /** The company the call acted on */
  company?: string;
  id: string;
  /** The arguments as indented JSON, secrets masked, cut at INPUT_SIZE; none before 2026-10-12 */
  input?: string;
  ok: boolean;
  /** What came of it: the tool's line, or the error the agent got. */
  result: string;
  /** What the agent asked for */
  summary: string;
  tool: string;
}

const isActivity = (value: unknown): value is McpActivity => {
  const entry = value as Partial<McpActivity> | null;
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof entry.at === 'string' &&
    (entry.company === undefined || typeof entry.company === 'string') &&
    typeof entry.id === 'string' &&
    (entry.input === undefined || typeof entry.input === 'string') &&
    typeof entry.ok === 'boolean' &&
    typeof entry.result === 'string' &&
    typeof entry.summary === 'string' &&
    typeof entry.tool === 'string'
  );
};

/** The saved activity log, newest first; entries it cannot read are dropped. */
export function readMcpActivity(storage?: Pick<Storage, 'getItem'>): Array<McpActivity> {
  try {
    const stored: unknown = JSON.parse(
      (storage ?? localStorage).getItem(ACTIVITY_STORAGE_KEY) ?? '[]',
    );
    return Array.isArray(stored) ? stored.filter(isActivity).slice(0, ACTIVITY_SIZE) : [];
  } catch {
    return [];
  }
}

export type McpServerState =
  | { kind: 'failed'; message: string }
  | { kind: 'off' }
  | { kind: 'running'; port: number }
  | { kind: 'starting' };

// Read on first use, not on import.
let settings: McpSettings | null = null;
const currentSettings = () => (settings ??= readMcpSettings());
/** Where the app saves a change (Rust, through menu-bar.ts). */
let saveSettings: ((settings: McpSettings) => void) | null = null;
let serverState: McpServerState = { kind: 'off' };
let activity: ReadonlyArray<McpActivity> | null = null;
const currentActivity = () => (activity ??= readMcpActivity());
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

function storeSettings(next: McpSettings, storage?: SettingsStorage) {
  settings = next;
  try {
    // The app's copy for the first render; Rust's wins once read.
    (storage ?? localStorage).setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // No storage: the choice lasts until the app quits.
  }
  notify();
}

/** A change made here: the MCP page, a test. */
export function setMcpSettings(next: Partial<McpSettings>, storage?: SettingsStorage) {
  const changed = { ...currentSettings(), ...next };
  storeSettings(changed, storage);
  saveSettings?.(changed);
}

/** The settings as the app saved them: at launch, and on a change from the menu bar. */
export function replaceMcpSettings(next: McpSettings, storage?: SettingsStorage) {
  if (!sameSettings(currentSettings(), next)) {
    storeSettings(next, storage);
  }
}

/** Sends every later change to `save`; null stops. */
export function onMcpSettingsChange(save: ((settings: McpSettings) => void) | null) {
  saveSettings = save;
}

export function setMcpServerState(state: McpServerState) {
  serverState = state;
  notify();
}

function saveActivity(next: ReadonlyArray<McpActivity>, storage?: SettingsStorage) {
  activity = next;
  try {
    (storage ?? localStorage).setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // No storage: the log lasts until the app quits.
  }
  notify();
}

/** Adds a call to the activity log, which keeps the newest ACTIVITY_SIZE. */
export function recordMcpActivity(entry: McpActivity, storage?: SettingsStorage) {
  saveActivity([entry, ...currentActivity()].slice(0, ACTIVITY_SIZE), storage);
}

export const clearMcpActivity = (storage?: SettingsStorage) => saveActivity([], storage);

export const getMcpSettings = currentSettings;
export const getMcpActivity = currentActivity;
/** Calls `onChange` after any change to the settings, the server or the log. */
export const subscribeMcp = subscribe;

export const useMcpSettings = () => useSyncExternalStore(subscribe, currentSettings);
export const useMcpServerState = () => useSyncExternalStore(subscribe, () => serverState);
export const useMcpActivity = () => useSyncExternalStore(subscribe, currentActivity);

/**
 * The tools as the MCP page names them, in tools/list order; mcp-tools.ts
 * gives clients the same titles. A gated tool works only while Ajanlar
 * onaylayabilir ve silebilir is on.
 */
export const MCP_TOOL_COPY = {
  list_invoices: {
    description: 'İki tarih arasındaki faturalar, en fazla 31 gün. Duruma ve alıcıya göre süzer.',
    title: 'Faturaları listele',
  },
  get_invoice: {
    description: 'Bir faturanın alıcısı, satırları ve tutarları ya da GİB görünümü',
    title: 'Faturayı getir',
  },
  create_invoice: {
    description: 'İmzasız taslak oluşturur, Yeni fatura’daki kurallarla',
    title: 'Taslak oluştur',
  },
  duplicate_invoice: {
    description: 'Bir faturadan bugünün tarihiyle yeni bir taslak oluşturur',
    title: 'Tekrar kes',
  },
  download_invoice: {
    description: 'Angaria PDF’ini, e-Arşiv PDF’ini ya da GİB’in ZIP’ini İndirilenler’e kaydeder',
    title: 'Faturayı indir',
  },
  request_signing_sms: {
    description: 'Taslakları onaylamak için GİB’den telefonuna SMS şifresi ister',
    gated: true,
    title: 'SMS şifresi iste',
  },
  sign_invoices: {
    description: 'Ajana yazdığın SMS şifresiyle taslakları onaylar. Onaylanan fatura kesinleşir.',
    gated: true,
    title: 'Taslakları onayla',
  },
  delete_draft: {
    description: 'İmzasız bir taslağı GİB’den siler. Onaylı faturalara dokunmaz.',
    gated: true,
    title: 'Taslağı sil',
  },
  list_customers: {
    description: 'Kayıtlı müşteriler ve fatura varsayılanları',
    title: 'Müşterileri listele',
  },
  get_customer: {
    description: 'Bir müşterinin bilgileri ve fatura varsayılanları',
    title: 'Müşteriyi getir',
  },
  create_customer: {
    description: 'Yeni bir müşteri kaydeder',
    title: 'Müşteri ekle',
  },
  update_customer: {
    description: 'Bir müşterinin bilgilerini ya da varsayılanlarını değiştirir',
    title: 'Müşteriyi güncelle',
  },
  delete_customer: {
    description: 'Bir müşteriyi kayıtlardan siler. Kestiğin faturalar etkilenmez.',
    gated: true,
    title: 'Müşteriyi sil',
  },
  list_services: {
    description: 'Kayıtlı hizmetler, fiyatları, para birimleri ve KDV oranları',
    title: 'Hizmetleri listele',
  },
  get_service: {
    description: 'Bir hizmetin fiyatı, birimi ve KDV oranı',
    title: 'Hizmeti getir',
  },
  create_service: {
    description: 'Yeni bir hizmet kaydeder',
    title: 'Hizmet ekle',
  },
  update_service: {
    description: 'Bir hizmetin adını, fiyatını ya da KDV oranını değiştirir',
    title: 'Hizmeti güncelle',
  },
  delete_service: {
    description: 'Bir hizmeti kayıtlardan siler. Kestiğin faturalar etkilenmez.',
    gated: true,
    title: 'Hizmeti sil',
  },
  list_companies: {
    description: 'Angaria’daki şirketler ve seçili olan. Araçlar seçili şirketle çalışır.',
    title: 'Şirketleri listele',
  },
  get_company_details: {
    description: 'PDF’e basılan firma ve banka bilgileri, PDF tasarımı',
    title: 'Firma bilgilerini getir',
  },
  update_company_details: {
    description: 'PDF’e basılan firma ve banka bilgilerini, IBAN dahil, değiştirir',
    gated: true,
    title: 'Firma bilgilerini güncelle',
  },
  get_exchange_rate: {
    description: 'TCMB’nin bir fatura tarihi için döviz alış kuru',
    title: 'Kuru getir',
  },
  check_gib_connection: {
    description: 'Kayıtlı kullanıcı koduyla GİB’e girip çıkar. Şifre ajana gitmez.',
    title: 'GİB bağlantısını dene',
  },
  close_gib_session: {
    description: 'e-Arşiv portalında açık kalan oturumu kapatır',
    gated: true,
    title: 'GİB oturumunu kapat',
  },
  scan_gib_import: {
    description: 'Onaylı faturalardan kaydedilecek müşterileri ve hizmetleri bulur',
    title: 'Eski faturaları tara',
  },
  apply_gib_import: {
    description: 'Taramada seçilen müşterileri ve hizmetleri kaydeder. Kayıtlı olanlara dokunmaz.',
    title: 'Taranan kayıtları ekle',
  },
} as const satisfies Record<string, { description: string; gated?: true; title: string }>;

export type McpToolName = keyof typeof MCP_TOOL_COPY;

export const mcpToolTitle = (name: string) => MCP_TOOL_COPY[name as McpToolName]?.title ?? name;

/** Whether the tool needs Ajanlar onaylayabilir ve silebilir. */
export const isGatedTool = (name: McpToolName) => 'gated' in MCP_TOOL_COPY[name];

/** How many calls the menu bar lists. */
export const MENU_BAR_ACTIVITY_SIZE = 5;

/** One call as the menu bar lists it (src-tauri/src/tray.rs, TrayActivity). */
export interface McpMenuBarActivity {
  /** ms since the epoch */
  at: number;
  company: string | null;
  ok: boolean;
  result: string;
  title: string;
}

/** The newest calls for the menu bar, with the tools' Turkish titles. */
export const menuBarActivity = (entries: ReadonlyArray<McpActivity>): Array<McpMenuBarActivity> =>
  entries
    .filter((entry) => Number.isFinite(Date.parse(entry.at)))
    .slice(0, MENU_BAR_ACTIVITY_SIZE)
    .map((entry) => ({
      at: Date.parse(entry.at),
      company: entry.company ?? null,
      ok: entry.ok,
      result: entry.result,
      title: mcpToolTitle(entry.tool),
    }));

/** A path or text as one single-quoted shell word. */
export const shellQuote = (text: string) => `'${text.replaceAll("'", String.raw`'\''`)}'`;

/** Adds the bridge to Claude Code for every project of this user. */
export const claudeCodeCommand = (bridgePath: string) =>
  `claude mcp add --scope user angaria -- ${shellQuote(bridgePath)}`;

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
