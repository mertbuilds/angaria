# 0013. Free and open source under the AGPL

Accepted, 2026-10-12. Supersedes `0002-polar-merchant-of-record.md`.

## Context

Angaria was built as a paid subscription sold through Polar (0002): license keys, an activation limit, a 7-day offline grace period and a lock screen. Before go-live Mert decided to give it away instead: Angaria is free, and its source is public at https://github.com/vinenastudio/angaria.

## Decision

- Angaria is free and open source under the GNU Affero General Public License version 3 only (`AGPL-3.0-only`). The full text is `LICENSE` at the repository root; every `package.json` and `Cargo.toml` names it.
- The AGPL and not a permissive license: anyone who changes Angaria and offers it to others, also as a hosted service over a network, has to publish their changes under the same terms. A fork that turns the app or its MCP server into a hosted product stays open.
- No billing and no license check. The app has no Polar client, no license screen, no license record in the vault and no Polar hosts in its CSP or http allowlist. It reaches only GİB, TCMB and `dl.angaria.app` (0004). A vault written by a paid build still loads; its `license` key is dropped on the next write.
- Ayarlar › Hakkında says the app is free software under the AGPL, links the source code (the AGPL's source offer), shows the license text and keeps the third-party notices.
- Code ported from other projects stays under licenses the AGPL can include, with its notices in `THIRD_PARTY_NOTICES.md`: add-mcp is Apache-2.0 (0011), which GPLv3-family licenses accept.
- Suisse Intl is commercially licensed and stays out of the repository: `pnpm fonts` fetches it from a private bucket for official releases only (`scripts/release-mac.sh` refuses to build without it). Every other build, a fresh clone included, uses the bundled Inter.

## Consequences

- Nobody pays, so nothing pays for Angaria. Mert accepts that.
- The site's pricing, checkout and Polar host list change with this decision (the web app's own change).
- Contributions come under the same license. There is no contributor license agreement, so relicensing later needs every contributor's consent.
- A build from source looks the same as an official build except for the font: Inter instead of Suisse Intl, in the UI and in the PDF.
