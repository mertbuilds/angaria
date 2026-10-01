import { resolve } from 'node:path';
import { unplugin as stylex } from '@stylexjs/unplugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Tauri loads devUrl (http://localhost:5173 in src-tauri/tauri.conf.json), so the
// dev server stays on a fixed port instead of a portless-assigned one.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
});
