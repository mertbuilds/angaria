# Angaria relaunch spec (2026-10-01)

Decisions from the grilling session with Mert. Every agent working on the relaunch reads this first.

## Product

- Angaria: Tauri desktop app that replaces the GİB e-Arşiv portal UI for Turkish freelancers (1-2 invoices/month).
- **Free and open source** (2026-10-12, Mert's call; it was a paid Polar subscription before): GNU Affero General Public License v3.0 only (`LICENSE`), source at https://github.com/mertbuilds/angaria. No billing, no license check, no trial. Why the AGPL: `docs/adr/0013-free-and-open-source.md`.
- Turkish only (app + site). Wordmark-only brand: `Angaria` with a capital A (Turkish suffixes after an apostrophe: Angaria'yı, Angaria'nın) in Suisse Intl Medium. No symbol mark.

## Repo layout (target)

Monorepo in web-starter shape (the web-starter template is the reference; copy its tooling, not its api/db/auth):

- pnpm + Turborepo, oxlint (`@nkzw/oxlint-config`, type-aware) + oxfmt, lefthook, mprocs, portless
- `apps/web`: landing page, TanStack Start on Cloudflare Workers, StyleX + shadcn-cssinjs components, Paraglide with base locale `tr`, OpenPanel self-hosted at analytics.vinena.studio (cookieless, since 2026-10-13; PostHog EU before); no Sentry, no api app, no db
- `apps/desktop`: Tauri 2 app, React 19, StyleX, TanStack Router
- `packages/ui`: shared tokens + components (Suisse fonts, theme.css, tokens.stylex.ts), consumed by web and desktop
- `packages/earsiv-sdk`, `packages/utils`: existing, moved to new tooling
- `packages/mcp-server`: ported from branch `origin/add-mcp-server`, not marketed; the app's built-in MCP server (2026-10-02) shares its tool inputs
- Vite+ (`vp`) is removed. The empty `apps/website` stub is deleted.

## Design canon

Source of truth: the attentionawareness repo's `packages/ui/src/theme.css` (+ `tokens.stylex.ts`, `ui/*.tsx`).

- Suisse Intl 400/500 only (woff2 gitignored, fetched by `scripts/fetch-fonts.sh`). Inter fallback. Headings weight 500, never bold. Its commercial license covers app embedding, not redistribution in source: the files never enter the repo, official releases fetch them, builds from source use Inter.
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
- Simplified (2026-10-01): no invoice templates. Yeni fatura starts from one of the last five invoices ("Tekrar kes") or a blank form. Customers and their service lines save themselves from every created draft. A customer carries invoice defaults (currency, invoice type, VAT rate, PDF language TR/EN/both, payment due in N days), learned from each invoice; without them: abroad (country not Türkiye, or VKN 2222222222) İstisna and an English PDF, at home Satış, lira and a Turkish PDF. Son ödeme tarihi prints on the PDF only. "Oluştur ve onayla" creates the draft and signs it by SMS in one go. Hizmetler (the saved service lines) is its own section after Müşteriler (2026-10-02; it was a tab inside Müşteriler). The company switcher shows only with two or more companies; the dev-only Emülatör sits in Ayarlar › Gelişmiş. The TCMB rate is always the previous business day's bulletin (the Kur günü setting was removed 2026-10-10). The GİB test portal mode is gone (2026-10-02): the local emulator replaces it.
- Import from past invoices (2026-10-10): after a company's first GİB login the app offers once (Atla to skip) to save the customers and services of its signed invoices, over 3 ay, 6 ay, 1 yıl (the default) or 2 yıl. The user picks them from two lists, saved ones show as Zaten kayıtlı and never change. Ayarlar › Veriler and ⌘K run it again.
- MCP (2026-10-02): a built-in MCP server under its own sidebar section after Hizmetler, off until switched on, so Claude, Cursor and other AI apps can work with invoices, customers and services. No Node, no environment variables, no password in a config file: the app bundles a stdio bridge and adds itself to Claude Desktop and Cursor in one click. Details: `docs/adr/0009-built-in-mcp-server.md`.
- MCP does everything (2026-10-10): every operation of the app is a tool, on any of the user's companies (a `company` argument; the app's selection never changes). A second switch, Ajanlar onaylayabilir ve silebilir (off by default), lets agents sign with the SMS code the user types to them, delete, and change the company details; the MCP page keeps an activity log and the app shows a toast for each such action. Details: `docs/adr/0010-mcp-agent-actions.md`.
- MCP in the background (2026-10-10): while MCP is on, closing the window keeps Angaria running in the menu bar without a Dock icon, and an agent's call starts a quit Angaria hidden. The menu bar icon shows MCP's state, its two switches and the agents' last calls, opens the window or Yeni fatura, sets Girişte başlat, and can be hidden. Details: `docs/adr/0012-mcp-in-the-background.md`.
- PDF: add TR/EN language toggle per invoice; keep the current visual template. Turkish labels + Turkish date/number formatting when TR.
- GİB credentials move to the OS keychain (Rust `keyring` crate via Tauri commands). One-time migration from localStorage (`fatura-entities` creds, legacy `fatura-creds`), then delete plaintext.
- Network: strict CSP + http allowlist. Allowed hosts only: `earsivportal.efatura.gov.tr`, `www.tcmb.gov.tr`, `dl.angaria.app` (updater). Nothing else; no analytics/telemetry in the app. The system browser opens the rule sources, angaria.app and the source code on GitHub.
- Licensing (2026-10-12): none. The Polar license gate, its grace period and the license record in the vault are gone. Ayarlar › Hakkında says Angaria is free software under the AGPL, links the source code (the AGPL source offer), shows the license text and the third-party notices.
- Updates: Tauri updater, signed manifest + bundles served from `https://dl.angaria.app` (Cloudflare R2). Check on launch, user confirms install.
- macOS universal, signed + notarized `.dmg` (reference pipeline: the Agent Caffeine release scripts). Windows later.
- Bundle id stays `com.vinena.angaria` (keeps existing localStorage data).

## Landing page (angaria.app)

Turkish. Sections:

1. Hero: "GİB ekranı yerine" message + app screenshot + "Mac için indir" CTA (free and open source since 2026-10-12).
2. MCP (2026-10-12, moved from its own /mcp page, which now redirects to `/#mcp`): Claude, Cursor and other AI apps list, draft and, with the user's SMS code, sign invoices; Angaria runs in the background from the menu bar; one-click setup; it runs on the Mac.
3. GİB vs Angaria: a compare slider over the GİB portal's e-Arşiv fatura form and Angaria's Yeni fatura.
4. Nasıl çalışır: three steps, each a looping scene.
5. Features, each a looping scene with a motion of its own (2026-10-12; cropped screenshots before): mevzuata göre uyarılar (the app's own rule messages, the cited law linked), geçen faturadan başla, geçen ayın faturasını tekrar kes, müşteri ve hizmet kayıtları, **Türkçe ve İngilizce güzel PDF faturalar** (to send to customers), yurt dışı müşteri ve TCMB kuru, birden fazla şirket.
6. Privacy: no Angaria server, no tracking, no analytics in the app; exact list of hosts the app talks to (GİB, TCMB, update check); credentials in system keychain; data stays on device.
7. Free and open source: no pricing (removed 2026-10-12); the AGPL and a link to the source code.
8. SSS (FAQ) as an accordion, all answers closed at first; footer.

Header (2026-10-12): the same as attentionawareness and Agent Caffeine: the app icon beside the name, the sections, GitHub and İndir; it gathers into a pill on scroll and has a menu on a phone. The app icon is in the header, not in the hero.

## Go-live

Build and test locally first (portless `https://angaria.localhost`). Nothing goes live (R2 bucket, Workers deploy, DNS, notarized release, the public GitHub repository) until Mert tests and says go. DNS for angaria.app is on Cloudflare.
