import { createFileRoute } from '@tanstack/react-router';
import { McpPage } from '@/pages/mcp.tsx';
import { Screen } from '@/shell/screen.tsx';

export const Route = createFileRoute('/mcp')({
  component: McpRoute,
});

function McpRoute() {
  return (
    <Screen title="MCP">
      <McpPage />
    </Screen>
  );
}
