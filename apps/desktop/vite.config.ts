import { resolve } from 'node:path';
import { unplugin as stylex } from '@stylexjs/unplugin';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Tauri loads devUrl (http://localhost:5173 in src-tauri/tauri.conf.json), so the
// dev server stays on a fixed port instead of a portless-assigned one.
export default defineConfig(({ mode }) => ({
  plugins: [
    // File routes in src/routes generate src/routeTree.gen.ts (committed, so
    // typecheck and lint work without a build). Must come before react().
    // autoCodeSplitting loads each route's component in its own chunk.
    tanstackRouter({ addExtensions: true, autoCodeSplitting: true, target: 'react' }),
    react(),
    // Compiles StyleX in src/ and in @angaria/ui (source-consumed). The build
    // appends its CSS to the main CSS asset; in dev the plugin injects
    // /virtual:stylex.css and its HMR runtime into every HTML page itself.
    // `before: ['base']` keeps the theme's @layer base under every StyleX layer.
    // Tests inject the rules at runtime, so jsdom renders hold the real CSS.
    stylex.vite({ runtimeInjection: mode === 'test', useCSSLayers: { before: ['base'] } }),
  ],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
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
}));
