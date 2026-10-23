# 0014. Paid again

Accepted, 2026-10-23. Supersedes `0013-free-and-open-source.md`. Brings back `0002-polar-merchant-of-record.md`, with a 7-day trial.

## Context

Angaria went free and open source under the AGPL on 2026-10-12 (0013), and the free 0.1.x builds shipped that way. Mert decided to sell it again at the prices of 0002 and to make the repository private. People already use the free builds; Mert decided they buy or start a trial like everyone else.

## Decision

- Polar sells Angaria again as in 0002: the Angaria org (Vinena Yazılım ve Tasarım Ltd. Şti.), "Angaria Yıllık" (1,499 TRY or $30 per year) and "Angaria Aylık" (199 TRY or $4 per month), each with a 7-day Polar trial (14 days in 0002) and the same license key benefit (3 Macs). The site has one checkout link per plan; the license screen's 7 gün ücretsiz dene (Abone ol once a key has lapsed) opens the yearly one. The app activates and validates keys through the customer-portal endpoints, validates on every launch, keeps working for 7 days offline after the last successful validation, and locks to the license screen on an invalid, expired or canceled key. The org id, API base, yearly checkout link and customer portal are build-time `VITE_POLAR_*` config (`apps/desktop/.env.production`, the sandbox in `.env.development`); a production build fails without them.
- There is no trial in the app. A key is needed from the first launch, as in 0002: the license screen offers 7 gün ücretsiz dene, which opens the yearly checkout (the trial starts there and Polar sends the key), and the key field. Users of the free 0.1.x builds see the license screen on their first launch of a paid build; their companies, customers and passwords stay as they were.
- Ayarlar › Lisans shows the license's status, key, e-mail, end date and last check, with Aboneliği yönet (Polar's customer portal) and Bu Mac’i kaldır (deactivates this Mac and locks it). It offers no purchase and takes no key: the license screen does both.
- The built-in MCP server follows the gate as before 0013: while the app is locked every tool answers with a Turkish license error, and a call during the launch check waits for it (up to 20 seconds).
- Dev builds skip the gate only with `VITE_LICENSE_BYPASS=1` in the dev server; production builds cannot.
- New versions are proprietary: `LICENSE` is an all-rights-reserved notice of Vinena Yazılım ve Tasarım Ltd. Şti., the manifests name no open source license (`Cargo.toml`: `Proprietary`), and the repository is private. Versions released under the AGPL stay under it. Ayarlar › Hakkında drops the AGPL notice, the source code link and the license text, and keeps the third-party notices (`THIRD_PARTY_NOTICES.md`), which the bundled code still requires.

## Consequences

- Polar is again one of the hosts the app reaches (`api.polar.sh`), and the site's privacy section lists it.
- Trying Angaria needs a Polar checkout, also for the free-build users. Mert accepts that; the trial's length is a Polar setting, not an app change.
- No outside contribution arrived while the repository was under the AGPL (2026-10-12 to 2026-10-23), so no contributor's consent is needed to relicense.
