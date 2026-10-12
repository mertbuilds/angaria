import { createFileRoute, redirect } from '@tanstack/react-router';

/** The MCP page moved into the landing's MCP section; old links land there. */
export const Route = createFileRoute('/mcp')({
  beforeLoad: () => {
    throw redirect({ hash: 'mcp', statusCode: 301, to: '/' });
  },
});
