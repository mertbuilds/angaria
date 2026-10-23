# 0014. Paid again, with a trial on every Mac

Accepted, 2026-10-23. Supersedes `0013-free-and-open-source.md`. Brings back `0002-polar-merchant-of-record.md` with the changes below.

## Context

Angaria went free and open source under the AGPL on 2026-10-12 (0013), and the free 0.1.x builds shipped that way. Mert decided to sell it again at the prices of 0002 and to make the repository private. People already use the free builds, and an update must not lock them out from one day to the next.

## Decision

- Polar sells Angaria again as in 0002: the Angaria org (Vinena Yazılım ve Tasarım Ltd. Şti.), "Angaria Yıllık" (1,499 TRY or $30 per year) and "Angaria Aylık" (199 TRY or $4 per month), each with a 14-day Polar trial and the same license key benefit (3 Macs). The site has one checkout link per plan; the app's Satın al opens the yearly one. The app activates and validates keys through the customer-portal endpoints, validates on every launch, keeps working for 7 days offline after the last successful validation, and locks to the license screen on an invalid, expired or canceled key. The org id, API base, yearly checkout link and customer portal are build-time `VITE_POLAR_*` config (`apps/desktop/.env.production`, the sandbox in `.env.development`); a production build fails without them.
- A Mac without a license gets a 14-day trial in the app, counted from the first launch of a paid build that finds no license and no trial. The trial's start lives in the vault next to the license (`trial: { startedAt }`) and is never started again, also after a license is removed. This covers the free 0.1.x users, whose vault holds only GİB passwords and sessions, and new installs alike, so nobody has to check out before trying the app. During the trial Ayarlar › Lisans offers Satın al and takes a license key; the last three days show a banner. An expired trial locks to the license screen with Satın al.
- The built-in MCP server follows the gate as before 0013: while the app is locked every tool answers with a Turkish license error, and a call during the launch check waits for it (up to 20 seconds). The trial counts as unlocked.
- Dev builds skip the gate only with `VITE_LICENSE_BYPASS=1` in the dev server; production builds cannot.
- New versions are proprietary: `LICENSE` is an all-rights-reserved notice of Vinena Yazılım ve Tasarım Ltd. Şti., the manifests name no open source license (`Cargo.toml`: `Proprietary`), and the repository is private. Versions released under the AGPL stay under it. Ayarlar › Hakkında drops the AGPL notice, the source code link and the license text, and keeps the third-party notices (`THIRD_PARTY_NOTICES.md`), which the bundled code still requires.

## Consequences

- Polar is again one of the hosts the app reaches (`api.polar.sh`), and the site's privacy section lists it.
- A new user gets the app's 14-day trial and, on checkout, Polar's 14-day trial on top. Mert accepts that; dropping Polar's trial is a Polar setting, not an app change.
- The trial resets when the vault is deleted from the keychain, which also deletes the GİB passwords. A clock set back lengthens a running trial (the license itself keeps 0002's clock checks); it never starts a new one.
- No outside contribution arrived while the repository was under the AGPL (2026-10-12 to 2026-10-23), so no contributor's consent is needed to relicense.
