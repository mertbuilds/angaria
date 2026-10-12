# Angaria

Angaria is a macOS app for Turkish freelancers who issue e-Arşiv invoices. It replaces the web UI of GİB's e-Arşiv portal (earsivportal.efatura.gov.tr): you create, sign and download invoices from a native app, and it talks to the same portal for you. The app is in Turkish.

Angaria is free and open source under the GNU Affero General Public License v3.0.

## Features

- Create e-Arşiv drafts, sign them with GİB's SMS code, and list, preview and download invoices (GİB's PDF and zip, or Angaria's own PDF in Turkish, English or both).
- Start a new invoice from a past one ("Tekrar kes") or from a blank form.
- Customers and services save themselves from every draft, with per-customer defaults (currency, invoice type, VAT rate, PDF language, due days). They can also be imported from your signed invoices on GİB.
- TCMB exchange rates for foreign currency invoices, from the bulletin the regulation names.
- More than one company, each with its own GİB account.
- A built-in MCP server (off by default) so Claude, Cursor and other MCP clients can work with your invoices, customers and services. A bundled stdio bridge adds itself to 22 clients in one click. Signing, deleting and changing company details need a second switch. Details: `docs/adr/0009-built-in-mcp-server.md`, `docs/adr/0010-mcp-agent-actions.md`, `docs/adr/0012-mcp-in-the-background.md`.
- No Angaria server and no telemetry. The app talks only to GİB, TCMB and its update server (`dl.angaria.app`). GİB passwords live in the macOS keychain.

## Repository

pnpm workspaces and Turborepo.

```
apps/
  desktop/      Tauri 2 + React 19 + Vite. Frontend in src/, Rust in src-tauri/.
  web/          angaria.app landing page (TanStack Start on Cloudflare Workers).
packages/
  earsiv-sdk/   GİB e-Arşiv portal client.
  gib-emulator/ Local GİB e-Arşiv portal and TCMB emulator for development.
  mcp-server/   Standalone MCP server (stdio) over the SDK.
  ui/           @angaria/ui design system (StyleX + Base UI).
  utils/        Shared helpers (TCMB rates).
```

`CLAUDE.md` describes the code base and its conventions in detail. Architecture decisions live in `docs/adr/`.

## Build from source

Requirements:

- macOS (the desktop app is macOS only for now) with the Xcode command line tools.
- Node 24 (`.nvmrc`) and pnpm (the version pinned in `packageManager`; `corepack enable` picks it up).
- Rust stable through rustup. `apps/desktop/src-tauri/rust-toolchain.toml` installs both macOS targets (`aarch64-apple-darwin`, `x86_64-apple-darwin`), which the MCP bridge build needs.

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts three processes with mprocs: the desktop app (`tauri dev`), the GİB and TCMB emulator on `http://127.0.0.1:5180`, and the landing page. In the app, turn on Ayarlar › Gelişmiş › Emülatör and log in with user `33333301`, password `1` (or `12345678` / `angaria`); the SMS code is `123456`. Never develop against the real GİB portal: it issues real, legal documents. The emulator's README is `packages/gib-emulator/README.md`.

Other commands:

| Command                             | What                                                 |
| ----------------------------------- | ---------------------------------------------------- |
| `pnpm emulate`                      | the GİB and TCMB emulator alone                      |
| `pnpm lint`, `pnpm typecheck`       | oxlint (type-aware) and tsc                          |
| `pnpm format`                       | oxfmt; `pnpm format:check` to verify                 |
| `pnpm test`                         | vitest in every package                              |
| `pnpm --filter desktop test:mcp`    | MCP end-to-end test (Rust harness, bridge, emulator) |
| `pnpm --filter desktop tauri build` | an app bundle in `src-tauri/target`                  |

Before a bare `cargo check`, `cargo clippy` or `cargo test` in `apps/desktop/src-tauri`, run `pnpm --filter desktop mcp-bridge` once.

### Fonts

The official app uses Suisse Intl. Its license is commercial, so the font files are not in this repository and must never be committed. Builds from source use Inter instead, in the UI and in the invoice PDF, and need nothing else. `pnpm fonts` fetches Suisse Intl from a private bucket for Vinena Studio's official releases; `scripts/release-mac.sh` refuses to build a release without it.

## Contributing

Issues and pull requests are welcome.

- Use conventional commits (`feat:`, `fix:`, ...). lefthook runs lint and format on commit and typecheck and tests on push.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm format:check` and `pnpm test` before you open a pull request. For Rust changes, also run `cargo clippy --all-targets -- -D warnings` and `cargo test` in `apps/desktop/src-tauri`.
- App text is Turkish and addresses the user as "sen".
- Code you port from another project must carry a license compatible with the AGPL. Add its notice to `THIRD_PARTY_NOTICES.md`.

By contributing you agree that your contribution is licensed under the AGPL-3.0, like the rest of the project.

## License

Copyright Vinena Studio.

Angaria is free software: you can redistribute it and modify it under the terms of the GNU Affero General Public License, version 3, as published by the Free Software Foundation. It comes with no warranty. The full text is in `LICENSE`.

If you run a modified version of Angaria for others, including over a network, the AGPL requires you to offer them its source code.

Code adapted from other projects keeps its own license; see `THIRD_PARTY_NOTICES.md`.
