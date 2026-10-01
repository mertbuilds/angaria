# angaria

Tauri desktop app that replaces the GİB e-Arşiv portal UI for Turkish freelancers. Read `docs/relaunch.md` first: it holds the product, repo layout, design, and go-live decisions for the relaunch.

## Layout

```
apps/
  desktop/      Tauri 2 + React 19 + Vite. Frontend in src/, Rust in src-tauri/.
  web/          angaria.app landing page. TanStack Start on Cloudflare Workers, Paraglide (tr only).
packages/
  earsiv-sdk/   GİB e-Arşiv portal client. tsdown build to dist/.
  gib-emulator/ Local GİB e-Arşiv portal and TCMB rates emulator. node:http, tsdown, vitest.
  ui/           @angaria/ui design system: StyleX + Base UI components, theme, fonts. Source-consumed, no build.
  utils/        Shared helpers (TCMB rates). tsdown build, vitest tests.
```

## Commands

| Command          | What                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| `pnpm dev`       | mprocs: desktop, gib emulator, web (`https://angaria.localhost`)          |
| `pnpm emulate`   | GİB and TCMB emulator on `http://127.0.0.1:5180` (packages/gib-emulator)  |
| `pnpm build`     | turbo build (workspace packages first, then the desktop and web apps)     |
| `pnpm typecheck` | `tsc --noEmit` per package via turbo                                      |
| `pnpm lint`      | builds packages and web, then oxlint type-aware + TS errors (tsgolint)    |
| `pnpm format`    | oxfmt (write mode); `pnpm format:check` to verify                         |
| `pnpm test`      | vitest per package via turbo                                              |
| `pnpm fonts`     | fetch licensed Suisse Intl woff2 into packages/ui/fonts (FONT_BUCKET_URL) |
| `cargo check`    | Rust check, run in `apps/desktop/src-tauri`                               |

Desktop: `pnpm --filter desktop tauri dev --config src-tauri/tauri.dev.conf.json` (same as `pnpm dev`; the overlay lets the app reach the emulator), `pnpm --filter desktop tauri build` for a bundle.

Web: `pnpm --filter web dev`, `build`, `test`, `brand` (re-renders favicon and OG image from Suisse Intl), `run deploy` (build + `wrangler deploy`; not before go-live, and `pnpm deploy` without `run` is pnpm's own command).

## Tooling

- pnpm workspaces + Turborepo, Node 24 (`.nvmrc`), pnpm pinned in `packageManager`. Shared versions live in the pnpm catalog (`pnpm-workspace.yaml`); packages use `catalog:`.
- Lint: oxlint with `@nkzw/oxlint-config`, type-aware (`oxlint.config.ts`). Format: oxfmt, single quotes, sorted imports (`oxfmt.config.ts`).
- Git hooks: lefthook. pre-commit runs oxlint `--fix` and oxfmt on staged files, then `pnpm lint`; commit-msg runs commitlint (conventional commits); pre-push runs typecheck and test.
- Workspace packages are consumed from their built `dist/`. Turbo's `^build` builds them before any dependent build, typecheck, or test, and Tauri's `beforeDevCommand` and `beforeBuildCommand` (`apps/desktop/src-tauri/tauri.conf.json`) go through turbo, so the app never bundles a stale SDK.
- The desktop dev server stays on the fixed port 5173 because Tauri loads `devUrl`. Web apps run behind portless (`https://<name>.localhost`) from `mprocs.yaml`.
- Never edit generated output: `dist/`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/target/`.

## GİB emulator (`packages/gib-emulator`)

- Never test against live GİB during development: the production portal issues real documents and the test portal's shared demo accounts are locked by other people's sessions. Use the emulator: `pnpm emulate`, users `33333301`/`1` and `12345678`/`angaria`, SMS code `123456`. README: `packages/gib-emulator/README.md`.
- SDK: `createClient({ baseUrl })`; TCMB: `fetchTCMBRates(date, { baseUrl })`. The SDK's tests start it in-process (`packages/earsiv-sdk/tests/emulator-setup.ts`); the smoke script takes `EARSIV_MODE=emulator`.
- Desktop: Ayarlar › GİB hesabı › Emülatör (dev only) sends GİB and TCMB calls to `VITE_GIB_EMULATOR_URL` (`.env.development`, plain http: the Tauri http plugin does not trust portless's CA). `src-tauri/tauri.dev.conf.json` adds it to the http allowlist for `tauri dev` only; production builds contain neither the URL nor the switch. A plain browser reaches it too (browser fetch; the emulator allows CORS).
- Faults (latency, 5xx, HTTP 200 with an error text, maintenance HTML, session locks) and state: the `/__emulator` API.

## Desktop shell (`apps/desktop`)

- Routing: TanStack Router file routes in `src/routes` (`/faturalar`, `/faturalar/$ettn`, `/yeni?sablon=&kaynak=`, `/musteriler`, `/sablonlar?sekme=kalemler`, `/ayarlar`). The Vite plugin regenerates `src/routeTree.gen.ts` on dev and build; it is committed so typecheck and lint run without a build. Never edit it.
- The frame lives in `src/shell`: `Screen` (a route's toolbar and content), `ListDetail` (list column and detail pane), `SearchableList` (a list column with search and ↑/↓/↵ keys), `useRequireCredentials`, `useAppActions`, the ⌘K palette and the shortcuts (⌘N, ⌘1-5, ⌘,).
- GİB: run every portal call through `gib` in `src/lib/gib.ts` (`gib.run`, `gib.lease` for SMS signing). GİB refuses a second login while a session is open, so the queue runs calls one at a time on one shared session; the query options there (`invoiceListQuery`, `invoiceDetailQuery`, `invoiceHTMLQuery`) already do. The SDK's `getDrafts` splits ranges into the seven days GİB allows per request.
- Browser without Tauri: `VITE_GIB_FIXTURES=1` (dev only) answers GİB calls from `src/dev/gib-fixtures.ts`; with `VITE_LICENSE_BYPASS=1` the screens run in a plain browser. GİB credentials still need a username and a password in localStorage `fatura-entities` there (the keychain is Tauri only).
- Screens not yet ported stay in `src/pages`, wrapped in `LegacyPage` with their Tailwind styles (`src/app.css`). Their colors are light-only, so `index.html` pins `data-theme="light"`; remove the pin with the last of them.
- Theme: Ayarlar › Görünüm saves the choice in localStorage `angaria-theme` (`src/lib/theme.ts`); `main.tsx` re-applies it before render, so a saved choice overrides the pin.
- Updates: `useUpdateCheck` (`src/shell`) checks once per launch outside dev and offers the update in a toast; Ayarlar › Hakkında checks on demand. Both go through `src/lib/updater.ts` (`@tauri-apps/plugin-updater`, then `relaunch` from `@tauri-apps/plugin-process`).
- Import `.stylex.ts` files (e.g. `shell.stylex.ts`) by relative path: the StyleX compiler does not resolve the `@/` alias and the build fails.

## UI (`packages/ui`)

- Components from `@angaria/ui`; CSS from `@angaria/ui/fonts.css`, `@angaria/ui/theme.css`, `@angaria/ui/base.css` (page shell), imported in that order; app tokens from `@angaria/ui/tokens.stylex` (`colors`, `spacing`, `font`, `radius`, `motion`); theme control from `@angaria/ui/theme` (`applyTheme`). Import `toast` from `@angaria/ui`, never from `sonner`.
- The package ships TypeScript source; every consumer compiles it with `@stylexjs/unplugin` (`stylex.vite({ useCSSLayers: { before: ['base'] } })`, see `apps/desktop/vite.config.ts`). Components take StyleX styles in `style`, never inline CSS.
- Theme: `data-theme` on `<html>` absent = follow the system, `light` or `dark` forces one; the attribute also themes any subtree.
- Gallery (dev only): `http://localhost:5173/ui-gallery.html` (or `/?ui-gallery`) while the desktop dev server runs. Every component, light and dark side by side.

## Web (`apps/web`)

- Config: public `VITE_` values in `apps/web/.env.development` (Polar sandbox checkout) and `.env.production` (go-live TODOs); local overrides in `.env.*.local`. The `deploy` script refuses to build without `VITE_CHECKOUT_URL`.
- Every user-facing string is a Paraglide message in `messages/tr.json`. Generated `src/paraglide/` and `src/routeTree.gen.ts` come from the web build, which `pnpm lint` and `pnpm typecheck` run first.
- Analytics: PostHog EU through the `/ingest` proxy, cookieless (`persistence: 'memory'`), page views plus named CTA events only. Without `VITE_POSTHOG_KEY` nothing loads.
- The privacy section lists exactly the hosts the desktop app reaches (`src/components/app-hosts.tsx`); a test fails when the desktop http allowlist or updater endpoint changes without it.
- `/gizlilik` and `/kosullar` are drafts marked `TODO(lawyer)` until reviewed.
