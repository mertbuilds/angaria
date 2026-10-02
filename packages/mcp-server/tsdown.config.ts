import { defineConfig } from 'tsdown';

export default defineConfig({
  // inputs.ts is the `@angaria/mcp-server/inputs` export the desktop app shares.
  dts: true,
  entry: ['src/index.ts', 'src/inputs.ts'],
});
