import { expect, test } from 'vitest';
import { claudeCodeCommand, MCP_TOOL_COPY } from '../../../desktop/src/lib/mcp.ts';
import { CLAUDE_CODE_COMMAND, MCP_TOOLS } from './mcp.ts';

// The MCP page promises the exact tool list, so it must move with the app: a
// tool added to or removed from the desktop server fails here until the page
// names it.
test('names exactly the tools of the desktop MCP server, in its order', () => {
  expect(MCP_TOOLS.map(({ name }) => name)).toEqual(Object.keys(MCP_TOOL_COPY));
});

test('shows the Claude Code command the app copies', () => {
  expect(CLAUDE_CODE_COMMAND).toBe(
    claudeCodeCommand('/Applications/Angaria.app/Contents/MacOS/angaria-mcp'),
  );
});
