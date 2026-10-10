import { describe, expect, test } from 'vitest';
import {
  ACTIVITY_SIZE,
  bridgeLocationProblem,
  clearMcpActivity,
  claudeCodeCommand,
  claudeCodeHTTPCommand,
  MCP_DEFAULT_PORT,
  mcpServersJSON,
  readMcpActivity,
  readMcpSettings,
  recordMcpActivity,
  shellQuote,
  type McpActivity,
} from '../src/lib/mcp.ts';

const storage = (value: string | null) => ({
  getItem: () => value,
  setItem: () => {},
});

describe('readMcpSettings', () => {
  test('is off on the default port until changed', () => {
    const off = { allowActions: false, enabled: false, port: MCP_DEFAULT_PORT };
    expect(readMcpSettings(storage(null))).toEqual(off);
    expect(readMcpSettings(storage('nope'))).toEqual(off);
  });

  test('keeps a saved switch and port, and drops ports it cannot use', () => {
    expect(readMcpSettings(storage('{"enabled":true,"port":5000}'))).toEqual({
      allowActions: false,
      enabled: true,
      port: 5000,
    });
    expect(readMcpSettings(storage('{"allowActions":true,"enabled":true}'))).toEqual({
      allowActions: true,
      enabled: true,
      port: MCP_DEFAULT_PORT,
    });
    expect(readMcpSettings(storage('{"allowActions":1,"enabled":"yes","port":80}'))).toEqual({
      allowActions: false,
      enabled: false,
      port: MCP_DEFAULT_PORT,
    });
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

  test('the HTTP variant carries the token in its header', () => {
    expect(claudeCodeHTTPCommand(41_234, 'abc')).toBe(
      "claude mcp add --scope user --transport http angaria http://127.0.0.1:41234/mcp --header 'Authorization: Bearer abc'",
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
});
