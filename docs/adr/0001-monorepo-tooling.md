# 0001. Monorepo tooling in the web-starter shape

Accepted, 2026-10-01.

## Context

The repo started as a Vite+ (`vp`) monorepo with the desktop app, the SDK, the utils package and an empty `apps/website` stub. The relaunch adds a landing page, a shared design system and a GİB emulator. Mert's other repos share one setup, kept in `mertbuilds/web-starter`.

## Decision

Copy web-starter's tooling, not its api, db or auth: pnpm workspaces with a catalog, Turborepo, oxlint (`@nkzw/oxlint-config`, type-aware) and oxfmt, lefthook with commitlint, mprocs and portless for dev. Remove Vite+ and the empty `apps/website`. Workspace packages build with tsdown and are consumed from `dist/`; `@angaria/ui` ships source.

## Consequences

- The commands, hooks and CI steps match the other repos, so a fix found in web-starter ports over directly.
- Turbo's `^build` builds packages before any dependent task, and Tauri's `beforeDevCommand` and `beforeBuildCommand` go through turbo, so the app never bundles a stale SDK.
- We keep turbo, oxlint and oxfmt current ourselves; Vite+ no longer bundles them.
