# Angaria

Angaria is a macOS app for Turkish freelancers who issue e-Arşiv invoices. It replaces the web UI of GİB's e-Arşiv portal (earsivportal.efatura.gov.tr): you create, sign and download invoices from a native app, and it talks to the same portal for you. The app is in Turkish.

Angaria is a paid subscription sold through Polar. This repository is private and its code is proprietary (`LICENSE`). This README is for the people who build and release it.

## Features

- Create e-Arşiv drafts, sign them with GİB's SMS code, and list, preview and download invoices (GİB's PDF and zip, or Angaria's own PDF in Turkish, English or both).
- Start a new invoice from a past one ("Tekrar kes") or from a blank form.
- Customers and services save themselves from every draft, with per-customer defaults (currency, invoice type, VAT rate, PDF language, due days). They can also be imported from your signed invoices on GİB.
- TCMB exchange rates for foreign currency invoices, from the bulletin the regulation names.
- More than one company, each with its own GİB account.
- A built-in MCP server (off by default) so Claude, Cursor and other MCP clients can work with your invoices, customers and services. A bundled stdio bridge adds itself to 22 clients in one click. Signing, deleting and changing company details need a second switch. Details: `docs/adr/0009-built-in-mcp-server.md`, `docs/adr/0010-mcp-agent-actions.md`, `docs/adr/0012-mcp-in-the-background.md`.
- No Angaria server and no telemetry. The app talks only to GİB, TCMB, Polar's license API (`api.polar.sh`) and its update server (`dl.angaria.app`). GİB passwords and the license live in the macOS keychain.

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

## Build

Requirements:

- macOS (the desktop app is macOS only for now) with the Xcode command line tools.
- Node 24 (`.nvmrc`) and pnpm (the version pinned in `packageManager`; `corepack enable` picks it up).
- Rust stable through rustup. `apps/desktop/src-tauri/rust-toolchain.toml` installs both macOS targets (`aarch64-apple-darwin`, `x86_64-apple-darwin`), which the MCP bridge build needs.

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts three processes with mprocs: the desktop app (`tauri dev`), the GİB and TCMB emulator on `http://127.0.0.1:5180`, and the landing page. The dev app checks licenses against the Polar sandbox; set `VITE_LICENSE_BYPASS=1` (in `apps/desktop/.env.development.local` or the shell) to skip the license gate in the dev server. In the app, turn on Ayarlar › Gelişmiş › Emülatör and log in with user `33333301`, password `1` (or `12345678` / `angaria`); the SMS code is `123456`. Never develop against the real GİB portal: it issues real, legal documents. The emulator's README is `packages/gib-emulator/README.md`.

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

The official app uses Suisse Intl. Its license is commercial, so the font files are not in this repository and must never be committed. Local builds without them use Inter, in the UI and in the invoice PDF. `pnpm fonts` fetches Suisse Intl from a private bucket; `scripts/release-mac.sh` refuses to build a release without it.

## Release

`scripts/release-mac.sh` builds, signs, notarizes and uploads a release; `docs/release.md` has the steps, the environment file and the go-live checklist. A production build needs the Polar values in `apps/desktop/.env.production` and fails without them.

## Licensing

How Angaria is sold: `docs/adr/0014-paid-again.md` (it brings back `docs/adr/0002-polar-merchant-of-record.md`).

- Polar is the merchant of record (Angaria org, Vinena Yazılım ve Tasarım Ltd. Şti.): a yearly and a monthly plan, each with a 7-day Polar trial, both granting the same license key (3 Macs). The license screen's 7 gün ücretsiz dene (Abone ol once a key has lapsed) opens the yearly checkout.
- The app activates and validates keys through Polar's customer-portal endpoints (no org token in the app), on every launch and every few hours while open. Polar unreachable: 7 days of grace after the last successful check. Invalid, expired or canceled: the license screen.
- There is no trial in the app: a key is needed from the first launch. The license screen's 7 gün ücretsiz dene opens the yearly checkout, where the trial starts.
- While the app is locked, every MCP tool answers with a Turkish license error.
- Config: `VITE_POLAR_API_BASE`, `VITE_POLAR_ORGANIZATION_ID`, `VITE_POLAR_CHECKOUT_URL` (the yearly checkout link) and `VITE_POLAR_PORTAL_URL`, production in `apps/desktop/.env.production`, the sandbox in `apps/desktop/.env.development`. They are public values that ship in the bundle, no secrets.

## Advanced: connect over HTTP

Clients that speak Streamable HTTP can skip the bridge and talk to the app's server directly. It listens on `http://127.0.0.1:<port>/mcp` while MCP is on in Angaria and the app runs. The port and the bearer token live in `~/Library/Application Support/com.vinena.angaria/mcp.json` (mode 0600): `port` is the port the server listens on now (port 41234, or the next free one up to nine on), `token` is the install's access token, made on first start. To start from another port, set `settings.port` there while Angaria is closed.

```sh
claude mcp add --scope user --transport http angaria http://127.0.0.1:41234/mcp \
  --header 'Authorization: Bearer <token from mcp.json>'
```

The token is a secret: anyone who has it can call the tools while the app runs. The server accepts only loopback requests without an `Origin` header. The bridge reads `mcp.json` itself, so client configs that use it hold no secret.

## Working on it

- Use conventional commits (`feat:`, `fix:`, ...). lefthook runs lint and format on commit and typecheck and tests on push.
- `pnpm install` runs `lefthook install`. It fails when a global `core.hooksPath` is set: unset it (`git config --global --unset core.hooksPath`) or install with `LEFTHOOK=0`.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm format:check` and `pnpm test` before you open a pull request. For Rust changes, also run `cargo clippy --all-targets -- -D warnings` and `cargo test` in `apps/desktop/src-tauri`.
- App text is Turkish and addresses the user as "sen".
- Code you port from another project must carry a license that allows use in proprietary software. Add its notice to `THIRD_PARTY_NOTICES.md`; the app shows it under Ayarlar › Hakkında.

## License

Copyright (c) 2026 Vinena Yazılım ve Tasarım Ltd. Şti. All rights reserved. See `LICENSE`. Code adapted from other projects keeps its own license; see `THIRD_PARTY_NOTICES.md`.
