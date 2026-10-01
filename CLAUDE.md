# angaria

Tauri desktop app that replaces the GİB e-Arşiv portal UI for Turkish freelancers. Read `docs/relaunch.md` first: it holds the product, repo layout, design, and go-live decisions for the relaunch.

## Layout

```
apps/
  desktop/      Tauri 2 + React 19 + Vite. Frontend in src/, Rust in src-tauri/.
packages/
  earsiv-sdk/   GİB e-Arşiv portal client. tsdown build to dist/.
  ui/           @angaria/ui design system: StyleX + Base UI components, theme, fonts. Source-consumed, no build.
  utils/        Shared helpers (TCMB rates). tsdown build, vitest tests.
```

## Commands

| Command          | What                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| `pnpm dev`       | mprocs: desktop (`tauri dev`)                                             |
| `pnpm build`     | turbo build (workspace packages first, then the desktop frontend)         |
| `pnpm typecheck` | `tsc --noEmit` per package via turbo                                      |
| `pnpm lint`      | builds packages, then oxlint type-aware + TS compiler errors (tsgolint)   |
| `pnpm format`    | oxfmt (write mode); `pnpm format:check` to verify                         |
| `pnpm test`      | vitest per package via turbo                                              |
| `pnpm fonts`     | fetch licensed Suisse Intl woff2 into packages/ui/fonts (FONT_BUCKET_URL) |
| `cargo check`    | Rust check, run in `apps/desktop/src-tauri`                               |

Desktop: `pnpm --filter desktop tauri dev` (same as `pnpm dev`), `pnpm --filter desktop tauri build` for a bundle.

## Tooling

- pnpm workspaces + Turborepo, Node 24 (`.nvmrc`), pnpm pinned in `packageManager`. Shared versions live in the pnpm catalog (`pnpm-workspace.yaml`); packages use `catalog:`.
- Lint: oxlint with `@nkzw/oxlint-config`, type-aware (`oxlint.config.ts`). Format: oxfmt, single quotes, sorted imports (`oxfmt.config.ts`).
- Git hooks: lefthook. pre-commit runs oxlint `--fix` and oxfmt on staged files, then `pnpm lint`; commit-msg runs commitlint (conventional commits); pre-push runs typecheck and test.
- Workspace packages are consumed from their built `dist/`. Turbo's `^build` builds them before any dependent build, typecheck, or test, and Tauri's `beforeDevCommand` and `beforeBuildCommand` (`apps/desktop/src-tauri/tauri.conf.json`) go through turbo, so the app never bundles a stale SDK.
- The desktop dev server stays on the fixed port 5173 because Tauri loads `devUrl`. Web apps run behind portless (`https://<name>.localhost`) from `mprocs.yaml`.
- Never edit generated output: `dist/`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/target/`.

## Desktop shell (`apps/desktop`)

- Routing: TanStack Router file routes in `src/routes` (`/faturalar`, `/faturalar/$ettn`, `/yeni?sablon=&kaynak=`, `/musteriler`, `/sablonlar?sekme=kalemler`, `/ayarlar`). The Vite plugin regenerates `src/routeTree.gen.ts` on dev and build; it is committed so typecheck and lint run without a build. Never edit it.
- The frame lives in `src/shell`: `Screen` (a route's toolbar and content), `ListDetail` (list column and detail pane), `useRequireCredentials`, `usePreviewTabs`, `useAppActions`, the ⌘K palette and the shortcuts (⌘N, ⌘1-5, ⌘,).
- Screens not yet ported stay in `src/pages`, wrapped in `LegacyPage` with their Tailwind styles (`src/app.css`). Their colors are light-only, so `index.html` pins `data-theme="light"`; remove the pin with the last of them.

## UI (`packages/ui`)

- Components from `@angaria/ui`; CSS from `@angaria/ui/fonts.css`, `@angaria/ui/theme.css`, `@angaria/ui/base.css` (page shell), imported in that order; app tokens from `@angaria/ui/tokens.stylex` (`colors`, `spacing`, `font`, `radius`, `motion`); theme control from `@angaria/ui/theme` (`applyTheme`). Import `toast` from `@angaria/ui`, never from `sonner`.
- The package ships TypeScript source; every consumer compiles it with `@stylexjs/unplugin` (`stylex.vite({ useCSSLayers: { before: ['base'] } })`, see `apps/desktop/vite.config.ts`). Components take StyleX styles in `style`, never inline CSS.
- Theme: `data-theme` on `<html>` absent = follow the system, `light` or `dark` forces one; the attribute also themes any subtree.
- Gallery (dev only): `http://localhost:5173/ui-gallery.html` (or `/?ui-gallery`) while the desktop dev server runs. Every component, light and dark side by side.
