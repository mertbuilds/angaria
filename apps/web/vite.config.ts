import { cloudflare } from '@cloudflare/vite-plugin';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { unplugin as stylex } from '@stylexjs/unplugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The `deploy` script sets ANGARIA_DEPLOY=1. A deploy refuses to ship without the
// checkout link; a plain build (lint, typecheck, local preview) still runs and
// the checkout buttons fall back to the pricing section.
const requiredDeployEnv = ['VITE_CHECKOUT_URL'];

export default defineConfig(({ command, mode }) => {
  if (command === 'build' && process.env['ANGARIA_DEPLOY'] === '1') {
    const env = loadEnv(mode, import.meta.dirname, 'VITE_');
    const missing = requiredDeployEnv.filter((name) => !env[name]);
    if (missing.length > 0) {
      throw new Error(
        `Deploy build is missing ${missing.join(', ')}. ` +
          'Set it in apps/web/.env.production or the environment.',
      );
    }
  }

  return {
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
    server: {
      // Vite ignores PORT by default; portless assigns one when proxying https://angaria.localhost.
      port: process.env['PORT'] ? Number(process.env['PORT']) : 3000,
    },
  };
});
