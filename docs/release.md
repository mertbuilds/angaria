# macOS release

`scripts/release-mac.sh` builds the universal macOS app, signs it with the Developer ID certificate, notarizes and staples the app and the `.dmg`, signs the updater bundle, writes `updates/latest.json`, and uploads everything to the Cloudflare R2 bucket behind `https://dl.angaria.app`.

Nothing is uploaded without `--publish`. The default run is a dry run that leaves the artifacts in `dist/release/`, laid out like the bucket.

```
scripts/release-mac.sh [patch|minor|major|X.Y.Z] [--publish] [--skip-notarize] [--notes TEXT]
```

## What the script does

1. Refuses a dirty working tree. With a version argument it bumps `apps/desktop/src-tauri/tauri.conf.json`, `Cargo.toml`, `Cargo.lock` and `apps/desktop/package.json`, and commits `chore(release): vX.Y.Z`. Otherwise it releases the version in `tauri.conf.json`.
2. Sources `~/.config/angaria/release.env`, runs `pnpm install --frozen-lockfile` and makes sure both Rust targets are installed.
3. `tauri build --target universal-apple-darwin --bundles app`. Tauri signs the app with `APPLE_SIGNING_IDENTITY` (hardened runtime). The script strips the Apple ID and API key variables for this step, so Tauri never notarizes on its own (it cannot use a notarytool keychain profile).
4. Notarizes the app with notarytool and staples it, then checks it with `stapler validate` and `spctl`.
5. Packs `Angaria.app.tar.gz` from the stapled app and signs it with `tauri signer sign --app-version <version>`. The version binding is required by `plugins.updater.requireSignedVersion`.
6. Builds the `.dmg` (app plus an Applications link), signs it, notarizes it, staples it, and checks it with `stapler validate` and `spctl`.
7. Writes `updates/latest.json`. `darwin-aarch64` and `darwin-x86_64` both point at the universal updater bundle.
8. With `--publish`: uploads the files below, `updates/latest.json` last, and prints the URLs.

| R2 key                                               | Cache-Control       | Purpose                                           |
| ---------------------------------------------------- | ------------------- | ------------------------------------------------- |
| `releases/<version>/Angaria_<version>_universal.dmg` | one year, immutable | Versioned installer                               |
| `releases/<version>/Angaria.app.tar.gz`              | one year, immutable | Updater bundle                                    |
| `releases/<version>/Angaria.app.tar.gz.sig`          | one year, immutable | Updater signature (also inlined in `latest.json`) |
| `latest/Angaria.dmg`                                 | five minutes        | Stable download link for the landing page         |
| `updates/latest.json`                                | one minute          | Updater manifest (`plugins.updater.endpoints`)    |

Because the versioned files are immutable, `--publish` refuses a version that is already live. Bump instead of republishing.

## One-time setup

### Developer ID certificate

In Xcode, open Settings, Accounts, Manage Certificates, then add a "Developer ID Application" certificate. Check it with:

```
security find-identity -v -p codesigning
```

The full identity name (`Developer ID Application: <name> (<team id>)`) goes into `APPLE_SIGNING_IDENTITY`.

### Notary credentials

Create an app-specific password at account.apple.com (Sign-In and Security, App-Specific Passwords), then store it in the keychain:

```
xcrun notarytool store-credentials angaria-notary \
  --apple-id <apple id> --team-id <team id> --password <app-specific password>
```

Check it with `xcrun notarytool history --keychain-profile angaria-notary`. Set `ANGARIA_NOTARY_PROFILE=angaria-notary`. Without a profile the script falls back to `APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID`.

### Updater signing key

The key pair already exists: the public key is `plugins.updater.pubkey` in `tauri.conf.json`, the private key is the file in `TAURI_SIGNING_PRIVATE_KEY_PATH`. Keep a backup of the private key and its password outside this Mac. If they are lost, installed apps reject every future update and users have to reinstall from the `.dmg` after a key rotation (`pnpm --filter desktop tauri signer generate -w <path>`, then replace the pubkey).

### Environment file

`~/.config/angaria/release.env` is sourced by the script and is never committed (`ANGARIA_RELEASE_ENV` points at another file).

| Variable                             | Purpose                                                      |
| ------------------------------------ | ------------------------------------------------------------ |
| `APPLE_SIGNING_IDENTITY`             | Developer ID Application identity, signs the app and the dmg |
| `APPLE_TEAM_ID`                      | Apple team ID                                                |
| `ANGARIA_NOTARY_PROFILE`             | notarytool keychain profile                                  |
| `APPLE_ID`, `APPLE_PASSWORD`         | Fallback notary credentials when no profile is set           |
| `TAURI_SIGNING_PRIVATE_KEY_PATH`     | Updater private key file                                     |
| `TAURI_SIGNING_PRIVATE_KEY`          | Alternative to the path: the key itself                      |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Updater private key password                                 |

Optional shell overrides: `ANGARIA_R2_BUCKET` (default `angaria-downloads`), `ANGARIA_DL_BASE_URL` (default `https://dl.angaria.app`).

### R2 bucket and dl.angaria.app

`angaria.app` is a Cloudflare zone, so the bucket gets a custom domain directly:

```
wrangler login
wrangler r2 bucket create angaria-downloads
wrangler r2 bucket domain add angaria-downloads --domain dl.angaria.app --zone-id <angaria.app zone id>
```

The dashboard path is R2, `angaria-downloads`, Settings, Custom Domains, Connect Domain. Keep the `r2.dev` public URL disabled. If the wrangler login sees more than one account, export `CLOUDFLARE_ACCOUNT_ID`. Check with `wrangler r2 bucket info angaria-downloads` and `wrangler r2 bucket domain list angaria-downloads`.

## Release steps

1. Local test build, no Apple round trip:

   ```
   scripts/release-mac.sh --skip-notarize
   ```

   Install `dist/release/releases/<version>/Angaria_<version>_universal.dmg` and test the app. This build is not notarized, so Gatekeeper blocks it on other Macs, and `--publish` refuses it.

2. Optional notarized dry run: `scripts/release-mac.sh`. The end of the output shows the `spctl` verdicts (`source=Notarized Developer ID`).

3. Release:

   ```
   scripts/release-mac.sh patch --publish --notes "Değişiklikler"
   ```

   This bumps and commits the version, builds, notarizes, and uploads. `--publish` always builds fresh; it does not upload the output of an earlier dry run.

4. Push the bump commit (`git push`).

5. Verify:

   ```
   curl -s https://dl.angaria.app/updates/latest.json
   curl -sI https://dl.angaria.app/latest/Angaria.dmg
   ```

   An installed older version offers the update on its next launch.

## Rollback

The updater only installs versions newer than the running one, so the fix for a bad release is a new patch release. To stop a bad release from spreading before that, upload a `latest.json` that points at the previous version (its bundle and `.sig` stay under `releases/<version>/`) and re-upload the previous dmg to `latest/Angaria.dmg` with `wrangler r2 object put ... --remote`.
