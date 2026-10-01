import nkzw from '@nkzw/oxlint-config';
import { defineConfig } from 'oxlint';

// Type-aware linting and TS compiler errors are enabled via CLI flags in the
// root `lint` script: `oxlint --type-aware --type-check` (powered by tsgolint).
export default defineConfig({
  extends: [nkzw],
  ignorePatterns: [
    'node_modules',
    'dist',
    '.output',
    '.turbo',
    'storybook-static',
    '.cloudflare',
    '.wrangler',
    'apps/desktop/src-tauri',
    'apps/web/src/paraglide',
    'apps/web/src/routeTree.gen.ts',
    '.claude/skills',
  ],
  overrides: [
    {
      files: ['**/*.test.*', '**/*.stories.*', '**/test/**', '**/tests/**', '**/scripts/**'],
      rules: {
        'react/jsx-no-literals': 'off',
      },
    },
    {
      // CLI scripts (e.g. the e-Arşiv smoke test) report to the terminal.
      files: ['**/scripts/**'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      // The desktop app is Turkish only and has no i18n layer, so its UI
      // strings are inline by design. Paraglide applies to apps/web.
      files: ['apps/desktop/**'],
      rules: {
        'react/jsx-no-literals': 'off',
      },
    },
    {
      // Pre-relaunch code keeps its object key order: sorting would reorder
      // ~950 literals, including the GİB request payloads built in the SDK.
      files: ['apps/desktop/src/**', 'packages/earsiv-sdk/**'],
      rules: {
        'perfectionist/sort-objects': 'off',
      },
    },
    {
      // Pre-relaunch desktop files (shadcn copies in components/ui included).
      // Fixing these changes behavior, not just code shape: hook deps and
      // effects change when code runs, the use* calls flagged in callbacks are
      // store actions, not hooks, and namespace imports would need call-site
      // rewrites. Drop a file from this list when the relaunch rewrites it.
      files: [
        'apps/desktop/src/app.tsx',
        'apps/desktop/src/components/invoice-picker-dialog.tsx',
        'apps/desktop/src/components/ui/**',
        'apps/desktop/src/hooks/use-mobile.ts',
        'apps/desktop/src/lib/store.tsx',
        'apps/desktop/src/pages/create-invoice.tsx',
        'apps/desktop/src/pages/customers.tsx',
        'apps/desktop/src/pages/invoice-templates.tsx',
        'apps/desktop/src/pages/invoices.tsx',
        'apps/desktop/src/pages/settings.tsx',
      ],
      rules: {
        'import/no-namespace': 'off',
        'react/exhaustive-deps': 'off',
        'react/incompatible-library': 'off',
        'react/purity': 'off',
        'react/rules-of-hooks': 'off',
        'react/set-state-in-effect': 'off',
      },
    },
    {
      // Web src runs in the browser and a Cloudflare Worker, not Node.
      files: ['apps/web/src/**'],
      rules: {
        'no-restricted-globals': [
          'error',
          {
            message:
              'Not available in web src. Use import.meta.env (Vite) or the Worker env binding (cloudflare:workers).',
            name: 'process',
          },
          { message: 'Not available in web src. Use Uint8Array or TextEncoder.', name: 'Buffer' },
          { message: 'Not available in web src. Use import.meta.url.', name: '__dirname' },
          { message: 'Not available in web src. Use import.meta.url.', name: '__filename' },
        ],
      },
    },
  ],
  rules: {
    // All user-facing strings in apps/web go through Paraglide (`m.*()`). This
    // catches hardcoded JSX text and text-bearing attributes; disable inline
    // only with a justification comment.
    'react/jsx-no-literals': [
      'error',
      {
        allowedStrings: ['•', '·', '/', '%', '×', '+'],
        restrictedAttributes: [
          'label',
          'placeholder',
          'title',
          'alt',
          'aria-label',
          'aria-description',
        ],
      },
    ],
  },
});
