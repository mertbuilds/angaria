import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// `pnpm --filter desktop test:mcp`: the built-in MCP server end to end
// (tests/mcp.e2e.ts). It needs the Rust harness and the bridge binary, which
// that script builds first, so `pnpm test` leaves it out.
export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      include: ['tests/**/*.e2e.ts'],
      testTimeout: 60_000,
    },
  }),
);
