# 0004. Downloads and updater on R2 behind dl.angaria.app

Accepted, 2026-10-01.

## Context

The desktop app needs a stable download link for the landing page and an update channel for the Tauri updater. We do not want to run a server for either.

## Decision

A Cloudflare R2 bucket (`angaria-downloads`) serves both through the custom domain `dl.angaria.app`; the `r2.dev` URL stays disabled. `scripts/release-mac.sh` uploads immutable versioned files under `releases/<version>/`, the stable `latest/Angaria.dmg`, and a static `updates/latest.json` manifest, uploaded last. The updater reads `https://dl.angaria.app/updates/latest.json`. Update bundles are signed with the updater key, and `plugins.updater.requireSignedVersion` makes each signature cover its version, so an old signed bundle cannot pass as a new release.

## Consequences

- There is no update server: the manifest is a file and a release is an upload.
- `dl.angaria.app` is on the app's http allowlist and in the privacy host list.
- Losing the updater private key means users reinstall from the `.dmg` after a key rotation.
- A bad release is fixed with a new patch release; to stop it spreading first, re-upload a `latest.json` that points at the previous version and the previous `.dmg` to `latest/Angaria.dmg`. Details: `docs/release.md`.
