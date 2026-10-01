# angaria

Tauri desktop app that replaces the GİB e-Arşiv portal UI for Turkish freelancers. Read `docs/relaunch.md` first: it holds the product, repo layout, design, and go-live decisions for the relaunch.

## Layout

```
apps/
  desktop/      Tauri 2 + React 19 + Vite. Frontend in src/, Rust in src-tauri/.
packages/
  earsiv-sdk/   GİB e-Arşiv portal client. tsdown build to dist/.
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
