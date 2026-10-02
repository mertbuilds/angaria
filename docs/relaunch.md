# Angaria relaunch spec (2026-10-01)

Decisions from the grilling session with Mert. Every agent working on the relaunch reads this first.

## Product

- Angaria: Tauri desktop app that replaces the GİB e-Arşiv portal UI for Turkish freelancers (1-2 invoices/month).
- Paid via **Polar** (new Vinena Studio org), two plans: yearly 1,499 TRY/year (the default) and monthly 199 TRY/month. One Polar product per interval, each with a USD fallback price and a **14-day free trial** (Polar subscription trial). Both grant the same license key benefit (3 Macs), cancel anytime.
- Turkish only (app + site). Wordmark-only brand: lowercase `angaria` in Suisse Intl Medium. No symbol mark.

## Repo layout (target)

Monorepo in web-starter shape (`/Users/duzgundev/code/mertbuilds/web-starter` is the reference; copy its tooling, not its api/db/auth):

- pnpm + Turborepo, oxlint (`@nkzw/oxlint-config`, type-aware) + oxfmt, lefthook, mprocs, portless
- `apps/web`: landing page, TanStack Start on Cloudflare Workers, StyleX + shadcn-cssinjs components, Paraglide with base locale `tr`, PostHog EU (cookieless: `persistence: 'memory'`); no Sentry, no api app, no db
- `apps/desktop`: Tauri 2 app, React 19, StyleX, TanStack Router
- `packages/ui`: shared tokens + components (Suisse fonts, theme.css, tokens.stylex.ts), consumed by web and desktop
- `packages/earsiv-sdk`, `packages/utils`: existing, moved to new tooling
- `packages/mcp-server`: ported from branch `origin/add-mcp-server`, not marketed; the app's built-in MCP server (2026-10-02) shares its tool inputs
- Vite+ (`vp`) is removed. The empty `apps/website` stub is deleted.

## Design canon

Source of truth: `/Users/duzgundev/code/mertbuilds/attentionawareness/packages/ui/src/theme.css` (+ `tokens.stylex.ts`, `ui/*.tsx`).

- Suisse Intl 400/500 only (woff2 gitignored, fetched by `scripts/fetch-fonts.sh`; local copies in `/Users/duzgundev/code/mertbuilds/knobs.dev/packages/ui/fonts/`). Inter fallback. Headings weight 500, never bold. License covers app embedding.
- Black/white; grays `#f5f5f5/#1a1a1a`, `#d4d4d4/#3f3f3f`, `#8a8a8a`. Only chroma: destructive `#dc2626/#f87171`, warning `#d97706/#fbbf24`. No emerald.
- Website only (2026-10-02): one bright blue, `#0098f2` (`--brand`, `apps/web/src/brand.css`), used sparingly: primary buttons, the selected plan, section markers, the compare slider. White text on it is 3.1:1 and fails AA, so buttons carry black text (6.8:1). Text in the blue (link hovers, check marks, the focus ring) uses the deeper `#006abb` on white (5.6:1). The hero sits on a still dot grid in a faint text color, faded at the edges and behind the headline.
- Desktop app (2026-10-02, after Mert found it hard to look at, dark mode most): `apps/desktop/src/palettes.css` layers a palette over the kit. Two palettes, both a user setting under Ayarlar › Görünüm › Renk paleti and in ⌘K: mist (Serin, cool blue-gray, the default) and paper (Sıcak, warm neutral); the brand-forward tide candidate was dropped. Tinted neutrals instead of black and white, soft text on a deep tinted gray in dark mode, regions parted by tone instead of borders, and the blue for primary buttons, selection, focus and the Onaylı badge. The content floats as a panel with 12px corners, 8px from the window edges and the sidebar, on the sidebar's tone (a very soft shadow in light mode, a faint 1px hairline in dark mode). A blue fill with white text is `#0077c8` (4.7:1); `#0098f2` carries dark text.
- Radius 8px cards/dialogs; pill buttons (28px, ~40px hit area) and pill inputs (40px).
- 4px spacing grid, 1px borders, no shadows/gradients. Dark mode follows system, `data-theme` override.
- Motion: 200ms fade, 260ms `cubic-bezier(0.16,1,0.3,1)`, respect reduced motion. The landing's scroll reveals rise 16px over 700ms on the same curve.
- No em dashes in copy. No unit abbreviations in copy.

## Desktop app

- Layout: macOS sidebar under overlay titlebar (Faturalar, Yeni fatura, Müşteriler, Hizmetler, MCP, Ayarlar; ⌘1-6, Ayarlar also ⌘,) + list/detail panes (invoice list → detail with preview). TanStack Router. ⌘K command palette (incl. "geçen ayın faturasını tekrar kes").
- Keep all existing flows working (GİB login/SMS, create draft, list, preview, customers, services, multi-entity, PDF).
- Simplified (2026-10-01): no invoice templates. Yeni fatura starts from one of the last five invoices ("Tekrar kes") or a blank form. Customers and their service lines save themselves from every created draft. A customer carries invoice defaults (currency, invoice type, VAT rate, PDF language TR/EN/both, payment due in N days), learned from each invoice; without them: abroad (country not Türkiye, or VKN 2222222222) İstisna and an English PDF, at home Satış, lira and a Turkish PDF. Son ödeme tarihi prints on the PDF only. "Oluştur ve onayla" creates the draft and signs it by SMS in one go. Hizmetler (the saved service lines) is its own section after Müşteriler (2026-10-02; it was a tab inside Müşteriler). The company switcher shows only with two or more companies; Kur günü (and the dev-only Emülatör) sit in Ayarlar › Gelişmiş. The GİB test portal mode is gone (2026-10-02): the local emulator replaces it.
- MCP (2026-10-02): a built-in MCP server under its own sidebar section after Hizmetler, off until switched on, so Claude, Cursor and other AI apps can list invoices, customers and services and create unsigned drafts. No Node, no environment variables, no password in a config file: the app bundles a stdio bridge and adds itself to Claude Desktop and Cursor in one click. No signing tool: the user signs by SMS in the app. Details: `docs/adr/0009-built-in-mcp-server.md`.
- PDF: add TR/EN language toggle per invoice; keep the current visual template. Turkish labels + Turkish date/number formatting when TR.
- GİB credentials move to the OS keychain (Rust `keyring` crate via Tauri commands). One-time migration from localStorage (`fatura-entities` creds, legacy `fatura-creds`), then delete plaintext.
- Network: strict CSP + http allowlist. Allowed hosts only: `earsivportal.efatura.gov.tr`, `www.tcmb.gov.tr`, Polar API (`api.polar.sh`, `sandbox-api.polar.sh` in dev), `dl.angaria.app` (updater). Nothing else; no analytics/telemetry in the app.
- Licensing (Polar license keys): customer-portal `activate` + `validate` endpoints (no org token in the app). Max 3 activations. Validate on every launch; offline/Polar down → keep working up to 7 days since last successful validation. Invalid/expired/canceled → lock to license screen. Store key + activation id + last-validated timestamp locally (keychain for the key). Polar org id + env (sandbox/production) are build-time config.
- Updates: Tauri updater, signed manifest + bundles served from `https://dl.angaria.app` (Cloudflare R2). Check on launch, user confirms install.
- macOS universal, signed + notarized `.dmg` (reference pipeline: `/Users/duzgundev/code/mertbuilds/caffeinagent/scripts`). Windows later.
- Bundle id stays `com.vinena.angaria` (keeps existing localStorage data).

## Landing page (angaria.app)

Turkish. Sections:

1. Hero: "GİB ekranı yerine" message + app screenshot + "Mac için indir" / "14 gün ücretsiz dene" CTA.
2. GİB vs Angaria: a compare slider over the GİB portal's e-Arşiv fatura form and Angaria's Yeni fatura.
3. Features: geçen faturadan başla, geçen ayın faturasını tekrar kes, müşteri ve hizmet kayıtları, **Türkçe ve İngilizce güzel PDF faturalar** (to send to customers).
4. Privacy: no Angaria server, no tracking, no analytics in the app; exact list of hosts the app talks to (GİB, TCMB, Polar license check, update check); credentials in system keychain; data stays on device.
5. Pricing: Yıllık / Aylık switch (default Yıllık): 1.499 ₺/yıl or 199 ₺/ay, 14 gün ücretsiz → that plan's Polar hosted checkout. Every other checkout button (header, hero) and the app's checkout link (14 gün ücretsiz dene, or Abone ol once licensed) open the yearly checkout.
6. SSS (FAQ), footer.

## Go-live

Build and test locally first (portless `https://angaria.localhost`, Polar **sandbox**). Nothing goes live (R2 bucket, Workers deploy, DNS, Polar production product, notarized release) until Mert tests and says go. DNS for angaria.app is on Cloudflare.
