import { defineConfig } from 'cf/config';

export default defineConfig({
  worker: {
    compatibilityDate: '2026-09-01',
    compatibilityFlags: ['nodejs_compat'],
    // The apex is the canonical host. www is a custom domain on this same
    // Worker so `canonicalRedirect` in src/server.ts can 301 it itself.
    domains: ['angaria.app', 'www.angaria.app'],
    // Custom entry: wraps @tanstack/react-start/server-entry with the www
    // redirect and the paraglide middleware.
    entrypoint: 'src/server.ts',
    name: 'angaria-web',
    // No request logs: the site promises anonymous analytics and nothing more.
    observability: {
      enabled: false,
    },
  },
});
