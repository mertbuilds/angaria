import { describe, expect, test, vi } from 'vitest';
import {
  ACTIVITY_SIZE,
  bridgeLocationProblem,
  clearMcpActivity,
  claudeCodeCommand,
  getMcpSettings,
  MCP_DEFAULT_PORT,
  mcpServersJSON,
  MENU_BAR_ACTIVITY_SIZE,
  menuBarActivity,
  onMcpSettingsChange,
  readMcpActivity,
  readMcpSettings,
  recordMcpActivity,
  replaceMcpSettings,
  setMcpSettings,
  shellQuote,
  subscribeMcp,
  type McpActivity,
  type McpSettings,
} from '../src/lib/mcp.ts';
import { startingSettings } from '../src/lib/menu-bar.ts';

const storage = (value: string | null) => ({
  getItem: () => value,
  setItem: () => {},
});

describe('readMcpSettings', () => {
  test('is off on the default port until changed', () => {
    const off = {
      allowActions: false,
      enabled: false,
      port: MCP_DEFAULT_PORT,
      showInMenuBar: true,
    };
    expect(readMcpSettings(storage(null))).toEqual(off);
    expect(readMcpSettings(storage('nope'))).toEqual(off);
  });

  test('keeps a saved switch and port, and drops ports it cannot use', () => {
    expect(readMcpSettings(storage('{"enabled":true,"port":5000}'))).toEqual({
      allowActions: false,
      enabled: true,
      port: 5000,
      showInMenuBar: true,
    });
    expect(
      readMcpSettings(storage('{"allowActions":true,"enabled":true,"showInMenuBar":false}')),
    ).toEqual({
      allowActions: true,
      enabled: true,
      port: MCP_DEFAULT_PORT,
      showInMenuBar: false,
    });
    expect(
      readMcpSettings(storage('{"allowActions":1,"enabled":"yes","port":80,"showInMenuBar":0}')),
    ).toEqual({
      allowActions: false,
      enabled: false,
      port: MCP_DEFAULT_PORT,
      showInMenuBar: true,
    });
  });
});

describe('settings kept in step with the app', () => {
  test('the first launch after the move hands localStorage’s settings to Rust', () => {
    const local: McpSettings = {
      allowActions: true,
      enabled: true,
      port: 5000,
      showInMenuBar: true,
    };
    expect(startingSettings(null, local)).toEqual({ save: true, settings: local });
    expect(startingSettings({ enabled: false, port: 41_235 }, local)).toEqual({
      save: false,
      settings: {
        allowActions: false,
        enabled: false,
        port: 41_235,
        showInMenuBar: true,
      },
    });
  });

  test('a change here goes to the app; one from the menu bar does not come back', () => {
    const saved: Array<McpSettings> = [];
    const store = memory();
    onMcpSettingsChange((settings) => saved.push(settings));
    const changed = vi.fn();
    const stop = subscribeMcp(changed);
    try {
      setMcpSettings({ enabled: true, showInMenuBar: false }, store);
      expect(saved).toEqual([getMcpSettings()]);
      expect(getMcpSettings()).toMatchObject({ enabled: true, showInMenuBar: false });
      expect(changed).toHaveBeenCalledTimes(1);

      // The app's echo of the same settings changes nothing.
      replaceMcpSettings({ ...getMcpSettings() }, store);
      expect(changed).toHaveBeenCalledTimes(1);

      // The menu bar switched the actions on.
      replaceMcpSettings({ ...getMcpSettings(), allowActions: true }, store);
      expect(changed).toHaveBeenCalledTimes(2);
      expect(getMcpSettings().allowActions).toBe(true);
      expect(saved).toHaveLength(1);
      expect(readMcpSettings(store)).toEqual(getMcpSettings());
    } finally {
      stop();
      onMcpSettingsChange(null);
    }
  });
});

describe('setup snippets', () => {
  const bridge = '/Applications/Angaria.app/Contents/MacOS/angaria-mcp';

  test('Claude Code runs the bridge for every project, with no secret', () => {
    expect(claudeCodeCommand(bridge)).toBe(`claude mcp add --scope user angaria -- '${bridge}'`);
    expect(shellQuote("/Users/o'brien/Angaria.app")).toBe(
      String.raw`'/Users/o'\''brien/Angaria.app'`,
    );
  });

  test('the JSON names the bridge only', () => {
    expect(JSON.parse(mcpServersJSON(bridge))).toEqual({
      mcpServers: { angaria: { args: [], command: bridge } },
    });
  });

  test('a bridge that will move is not offered to clients', () => {
    expect(bridgeLocationProblem(bridge)).toBeNull();
    expect(
      bridgeLocationProblem(
        '/private/var/folders/x/T/AppTranslocation/1/d/Angaria.app/Contents/MacOS/angaria-mcp',
      ),
    ).toBe('translocated');
    expect(bridgeLocationProblem('/Volumes/Angaria/Angaria.app/Contents/MacOS/angaria-mcp')).toBe(
      'volume',
    );
  });
});

const memory = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};
const entry = (id: number): McpActivity => ({
  at: new Date(2026, 9, 2, 12, 0, id).toISOString(),
  company: 'Ana şirket',
  id: String(id),
  ok: true,
  result: 'Tamam',
  summary: 'Faturaları listele',
  tool: 'list_invoices',
});

const activityEntry = (index: number, extra: Partial<McpActivity> = {}): McpActivity => ({
  at: new Date(Date.UTC(2026, 9, 10, 12, index)).toISOString(),
  company: 'Acme',
  id: String(index),
  ok: true,
  result: 'Taslak oluşturuldu',
  summary: '',
  tool: 'create_invoice',
  ...extra,
});

describe('menu bar activity', () => {
  test('lists the newest five with the tools’ titles', () => {
    const entries = [
      activityEntry(9, { at: 'not a date' }),
      ...Array.from({ length: 7 }, (_, index) => activityEntry(index)),
    ];
    const listed = menuBarActivity(entries);
    expect(listed).toHaveLength(MENU_BAR_ACTIVITY_SIZE);
    expect(listed[0]).toEqual({
      at: Date.UTC(2026, 9, 10, 12, 0),
      company: 'Acme',
      ok: true,
      result: 'Taslak oluşturuldu',
      title: 'Taslak oluştur',
    });
    expect(
      menuBarActivity([activityEntry(1, { company: undefined, tool: 'unknown_tool' })])[0],
    ).toMatchObject({ company: null, title: 'unknown_tool' });
  });
});

describe('activity log', () => {
  test('keeps the newest entries on this Mac, at most ACTIVITY_SIZE, until cleared', () => {
    const storage = memory();
    clearMcpActivity(storage);
    for (let id = 0; id < ACTIVITY_SIZE + 5; id++) {
      recordMcpActivity(entry(id), storage);
    }
    const saved = readMcpActivity(storage);
    expect(saved).toHaveLength(ACTIVITY_SIZE);
    expect(saved[0]?.id).toBe(String(ACTIVITY_SIZE + 4));
    clearMcpActivity(storage);
    expect(readMcpActivity(storage)).toEqual([]);
  });

  test('drops what it cannot read', () => {
    expect(readMcpActivity(storage('nope'))).toEqual([]);
    expect(readMcpActivity(storage(JSON.stringify([entry(1), { id: 2 }, null])))).toEqual([
      entry(1),
    ]);
  });

  test('reads entries with and without input, and drops an input that is not text', () => {
    const withInput = { ...entry(2), input: '{\n  "page": 1\n}' };
    expect(
      readMcpActivity(storage(JSON.stringify([entry(1), withInput, { ...entry(3), input: 4 }]))),
    ).toEqual([entry(1), withInput]);
  });
});
