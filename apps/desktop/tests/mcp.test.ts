import { describe, expect, test } from 'vitest';
import {
  bridgeLocationProblem,
  claudeCodeCommand,
  claudeCodeHTTPCommand,
  MCP_DEFAULT_PORT,
  mcpServersJSON,
  readMcpSettings,
  shellQuote,
} from '../src/lib/mcp.ts';

const storage = (value: string | null) => ({
  getItem: () => value,
  setItem: () => {},
});

describe('readMcpSettings', () => {
  test('is off on the default port until changed', () => {
    expect(readMcpSettings(storage(null))).toEqual({ enabled: false, port: MCP_DEFAULT_PORT });
    expect(readMcpSettings(storage('nope'))).toEqual({ enabled: false, port: MCP_DEFAULT_PORT });
  });

  test('keeps a saved switch and port, and drops ports it cannot use', () => {
    expect(readMcpSettings(storage('{"enabled":true,"port":5000}'))).toEqual({
      enabled: true,
      port: 5000,
    });
    expect(readMcpSettings(storage('{"enabled":"yes","port":80}'))).toEqual({
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
