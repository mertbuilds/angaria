# 0003. Landing page on Cloudflare Workers

Accepted, 2026-10-01.

## Context

angaria.app needs a server-rendered Turkish landing page, legal pages and a first-party proxy for analytics. DNS for angaria.app is on Cloudflare, and the downloads live on Cloudflare R2 (0004).

## Decision

`apps/web` is TanStack Start on Cloudflare Workers (`@cloudflare/vite-plugin` and the `cf` CLI with `cloudflare.config.ts`; wrangler.jsonc until 2026-10-13). The apex `angaria.app` is the canonical host. `www.angaria.app` is a second custom domain on the same Worker, and `canonicalRedirect` (`src/lib/canonical.ts`) sends it to the apex with a 301, keeping path and query. Worker request logs are off. Deploys: `pnpm --filter web run deploy` (`cf deploy --prebuilt`) or the deploy workflow, which runs on every push to `main` that touches the site since go-live (2026-10-13).

## Consequences

- DNS, the site and the downloads sit with one vendor and one account.
- The www redirect is code with a test, not a dashboard rule.
- The site runs on the Workers runtime (`nodejs_compat`), so server code avoids Node-only APIs the runtime lacks.
