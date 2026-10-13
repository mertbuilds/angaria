import { defineConfig } from 'oxfmt';

export default defineConfig({
  experimentalSortImports: { newlinesBetween: false },
  experimentalSortPackageJson: { sortScripts: true },
  ignorePatterns: [
    'node_modules',
    'dist',
    '.output',
    '.turbo',
    'storybook-static',
    'apps/desktop/src-tauri/target',
    'apps/desktop/src-tauri/gen',
    'apps/desktop/src/routeTree.gen.ts',
    'apps/web/src/paraglide',
    'apps/web/src/routeTree.gen.ts',
    '.cloudflare',
    '.wrangler',
    'pnpm-lock.yaml',
    '.claude/skills',
  ],
  singleQuote: true,
});
