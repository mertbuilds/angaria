import { resolve } from 'node:path';
import { unplugin as stylex } from '@stylexjs/unplugin';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const requiredProductionEnv = [
  'VITE_POLAR_API_BASE',
  'VITE_POLAR_ORGANIZATION_ID',
  'VITE_POLAR_CHECKOUT_URL',
  'VITE_POLAR_PORTAL_URL',
];

// Tauri loads devUrl (http://localhost:5173 in src-tauri/tauri.conf.json), so the
// dev server stays on a fixed port instead of a portless-assigned one.
export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'production') {
    const env = loadEnv(mode, import.meta.dirname, 'VITE_');
    const missing = requiredProductionEnv.filter((name) => !env[name]);
    if (missing.length > 0) {
      throw new Error(
        `Production build is missing Polar license config: ${missing.join(', ')}. ` +
          'Set them in apps/desktop/.env.production or the environment.',
      );
    }
  }

  return {
    plugins: [
      // File routes in src/routes generate src/routeTree.gen.ts (committed, so
      // typecheck and lint work without a build). Must come before react().
      tanstackRouter({ addExtensions: true, target: 'react' }),
      react(),
      // Compiles StyleX in src/ and in @angaria/ui (source-consumed). The build
      // appends its CSS to the main CSS asset; in dev the plugin injects
      // /virtual:stylex.css and its HMR runtime into every HTML page itself.
      // `before: ['base']` keeps the theme's @layer base under every StyleX layer.
      stylex.vite({ useCSSLayers: { before: ['base'] } }),
    ],
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      hmr: {
        host: 'localhost',
        port: 5173,
        protocol: 'ws',
      },
      port: 5173,
      strictPort: true,
    },
  };
});
