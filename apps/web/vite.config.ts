import { cloudflare } from '@cloudflare/vite-plugin';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { unplugin as stylex } from '@stylexjs/unplugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The `deploy` script sets ANGARIA_DEPLOY=1. A deploy refuses to ship without
// both plans' checkout links; a plain build (lint, typecheck, local preview)
// still runs and the checkout buttons fall back to the pricing section.
const requiredDeployEnv = ['VITE_CHECKOUT_URL_YEARLY', 'VITE_CHECKOUT_URL_MONTHLY'];

// Dependencies of @angaria/ui (source-consumed). Routes reach it through Start's
// virtual modules, which the dep scanner cannot follow, so dev found each one on
// the first request and re-bundled mid-render: a cold start served 500s
// ("Cannot read properties of null (reading 'useEffect')"). Listing them here
// bundles them at startup. Add an entry when @angaria/ui imports a new package,
// @base-ui/react subpath or react-aria-components subpath.
const uiDependencies = [
  'alert-dialog',
  'button',
  'checkbox',
  'combobox',
  'dialog',
  'input',
  'menu',
  'merge-props',
  'otp-field',
  'popover',
  'radio',
  'radio-group',
  'scroll-area',
  'select',
  'separator',
  'switch',
  'tabs',
  'tooltip',
  'use-render',
]
  .map((subpath) => `@base-ui/react/${subpath}`)
  .concat(
    ['Calendar', 'DateField', 'I18nProvider'].map((subpath) => `react-aria-components/${subpath}`),
  )
  .concat([
    '@internationalized/date',
    '@internationalized/number',
    '@maskito/core',
    '@maskito/kit',
    '@maskito/react',
    'cmdk',
    'react-aria-components',
    'sonner',
  ])
  .map((dependency) => `@angaria/ui > ${dependency}`);

export default defineConfig(({ command, mode }) => {
  if (command === 'build' && process.env['ANGARIA_DEPLOY'] === '1') {
    const env = loadEnv(mode, import.meta.dirname, 'VITE_');
    const missing = requiredDeployEnv.filter((name) => !env[name]);
    if (missing.length > 0) {
      throw new Error(
        `Deploy build is missing ${missing.join(', ')}. ` +
          'Set them in apps/web/.env.production or the environment.',
      );
    }
  }

  return {
    optimizeDeps: { include: uiDependencies },
    plugins: [
      cloudflare({ viteEnvironment: { name: 'ssr' } }),
      tanstackStart(),
      react({ compiler: true }),
      // Compiles StyleX in src/ and in @angaria/ui (source-consumed).
      // debug:false: StyleX's dev `data-style-src` attribute embeds file:line, and the
      // React Compiler (client-only) shifts line numbers vs the SSR transform, causing a
      // hydration attribute mismatch that detaches React's event tree.
      // `before: ['base']` keeps the theme's @layer base under every StyleX layer.
      stylex.vite({ debug: false, useCSSLayers: { before: ['base'] } }),
      paraglideVitePlugin({
        outdir: './src/paraglide',
        project: './project.inlang',
        // Turkish only, so the base locale is the whole strategy: no cookie and
        // no browser preference can resolve anything else.
        strategy: ['baseLocale'],
      }),
    ],
    resolve: { dedupe: ['react', 'react-dom'] },
    server: {
      // Vite ignores PORT by default; portless assigns one when proxying https://angaria.localhost.
      port: process.env['PORT'] ? Number(process.env['PORT']) : 3000,
    },
    ssr: { optimizeDeps: { include: uiDependencies } },
  };
});
