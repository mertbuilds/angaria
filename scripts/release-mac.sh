#!/usr/bin/env bash
# macOS release: universal build, sign, notarize, staple, updater manifest, R2 upload.
# One-time setup and the release steps: docs/release.md.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/release-mac.sh [patch|minor|major|X.Y.Z] [--publish] [--skip-notarize] [--notes TEXT]

  patch|minor|major|X.Y.Z  Bump the version in tauri.conf.json, Cargo.toml, Cargo.lock
                           and apps/desktop/package.json, and commit the bump first.
  --publish                Upload the release to R2. Without it the run is a dry run:
                           artifacts are built into dist/release and nothing is uploaded.
  --skip-notarize          Sign only, skip notarization (local test builds, never published).
  --notes TEXT             Release notes for updates/latest.json (default: "Angaria <version>").

Environment: ~/.config/angaria/release.env (override with ANGARIA_RELEASE_ENV).
ANGARIA_R2_BUCKET (default angaria-downloads), ANGARIA_DL_BASE_URL (default https://dl.angaria.app).
EOF
}

die() {
  echo "error: $*" >&2
  exit 1
}

step() {
  echo
  echo "==> $*"
}

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_DIR="$ROOT/apps/desktop/src-tauri"
TAURI_CONF="$TAURI_DIR/tauri.conf.json"
ENV_FILE="${ANGARIA_RELEASE_ENV:-$HOME/.config/angaria/release.env}"
BUCKET="${ANGARIA_R2_BUCKET:-angaria-downloads}"
BASE_URL="${ANGARIA_DL_BASE_URL:-https://dl.angaria.app}"
BASE_URL="${BASE_URL%/}"
APP_NAME="Angaria"
OUT="$ROOT/dist/release"
SEMVER_RE='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'

bump=""
publish=0
notarize=1
notes=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --publish) publish=1 ;;
    --skip-notarize) notarize=0 ;;
    --notes)
      [[ $# -ge 2 ]] || die "--notes needs a value"
      notes=$2
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*) die "unknown option: $1 (see --help)" ;;
    *)
      [[ -z $bump ]] || die "only one version argument is allowed"
      bump=$1
      ;;
  esac
  shift
done

if [[ $publish -eq 1 && $notarize -eq 0 ]]; then
  die "--publish needs a notarized build, drop --skip-notarize"
fi

cd "$ROOT"
if [[ -n "$(git status --porcelain)" ]]; then
  git status --short >&2
  die "working tree is dirty, commit or stash first"
fi

[[ -f $ENV_FILE ]] || die "missing $ENV_FILE (see docs/release.md)"

if [[ -d $HOME/.cargo/bin ]]; then
  PATH="$HOME/.cargo/bin:$PATH"
fi

# Before the release env is sourced, so dependency install scripts never see
# the signing and notary secrets.
step "install dependencies and rust targets"
pnpm install --frozen-lockfile
(cd "$TAURI_DIR" && rustup target add aarch64-apple-darwin x86_64-apple-darwin)

set -a
# shellcheck source=/dev/null
. "$ENV_FILE"
set +a

[[ -n ${APPLE_SIGNING_IDENTITY:-} ]] || die "APPLE_SIGNING_IDENTITY is not set in $ENV_FILE"

# `tauri signer sign` needs a path in TAURI_SIGNING_PRIVATE_KEY_PATH or the
# literal key, not both.
key_path=${TAURI_SIGNING_PRIVATE_KEY_PATH:-}
if [[ -z $key_path && -f ${TAURI_SIGNING_PRIVATE_KEY:-} ]]; then
  key_path=$TAURI_SIGNING_PRIVATE_KEY
fi
if [[ -n $key_path ]]; then
  [[ -f $key_path ]] || die "updater signing key not found at $key_path"
elif [[ -z ${TAURI_SIGNING_PRIVATE_KEY:-} ]]; then
  die "set TAURI_SIGNING_PRIVATE_KEY_PATH or TAURI_SIGNING_PRIVATE_KEY in $ENV_FILE"
fi

notary_auth=()
if [[ $notarize -eq 1 ]]; then
  if [[ -n ${ANGARIA_NOTARY_PROFILE:-} ]]; then
    notary_auth=(--keychain-profile "$ANGARIA_NOTARY_PROFILE")
  elif [[ -n ${APPLE_ID:-} && -n ${APPLE_PASSWORD:-} && -n ${APPLE_TEAM_ID:-} ]]; then
    notary_auth=(--apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID")
  else
    die "set ANGARIA_NOTARY_PROFILE, or APPLE_ID + APPLE_PASSWORD + APPLE_TEAM_ID (or pass --skip-notarize)"
  fi
fi

read_version() {
  node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).version' "$TAURI_CONF"
}

version_key() {
  local major minor patch
  IFS=. read -r major minor patch <<<"$1"
  printf '%06d%06d%06d' "$major" "$minor" "$patch"
}

version=$(read_version)
[[ $version =~ $SEMVER_RE ]] || die "unsupported version in tauri.conf.json: $version"

if [[ -n $bump ]]; then
  IFS=. read -r major minor patch <<<"$version"
  case "$bump" in
    major) next="$((major + 1)).0.0" ;;
    minor) next="$major.$((minor + 1)).0" ;;
    patch) next="$major.$minor.$((patch + 1))" ;;
    *) next=$bump ;;
  esac
  [[ $next =~ $SEMVER_RE ]] || die "invalid version: $next (use patch, minor, major or X.Y.Z)"
  if [[ ! "$(version_key "$next")" > "$(version_key "$version")" ]]; then
    die "new version $next must be greater than $version"
  fi
fi

if [[ $publish -eq 1 ]]; then
  step "check publish target"
  command -v wrangler >/dev/null || die "wrangler not found on PATH (npm i -g wrangler)"
  wrangler r2 bucket info "$BUCKET" >/dev/null || die "cannot reach R2 bucket $BUCKET (wrangler login, bucket created?)"
  published_version=${next:-$version}
  status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/releases/$published_version/$APP_NAME.app.tar.gz.sig" || true)
  if [[ $status == 200 ]]; then
    die "$published_version is already published, bump the version first"
  fi
  echo "bucket $BUCKET reachable, $published_version not published yet"
fi

if [[ -n $bump ]]; then
  step "bump version $version -> $next"
  NEXT="$next" perl -pi -e 's/^(  "version": ")[^"]*/$1$ENV{NEXT}/' \
    "$TAURI_CONF" apps/desktop/package.json
  NEXT="$next" perl -pi -e 's/^version = "[^"]*"/version = "$ENV{NEXT}"/' "$TAURI_DIR/Cargo.toml"
  NEXT="$next" perl -0pi -e 's/(\nname = "angaria"\nversion = ")[^"]*/$1$ENV{NEXT}/' "$TAURI_DIR/Cargo.lock"
  bumped=("$TAURI_CONF" "$TAURI_DIR/Cargo.toml" "$TAURI_DIR/Cargo.lock" apps/desktop/package.json)
  for file in "${bumped[@]}"; do
    if git diff --quiet -- "$file"; then
      die "version bump did not apply to $file"
    fi
  done
  git add "${bumped[@]}"
  git commit -m "chore(release): v$next"
  version=$next
fi

step "release $version (notarize: $([[ $notarize -eq 1 ]] && echo yes || echo no), publish: $([[ $publish -eq 1 ]] && echo yes || echo no))"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
rm -rf "$OUT"
REL="$OUT/releases/$version"
mkdir -p "$REL" "$OUT/updates"

step "tauri build (universal-apple-darwin, app bundle)"
# Tauri only signs here. Notarization runs below through notarytool, so the
# credentials Tauri would use to notarize on its own are stripped. So is the
# updater key: with bundle.createUpdaterArtifacts off the build never needs it,
# the updater bundle is packed and signed below from the stapled app.
env -u APPLE_ID -u APPLE_PASSWORD -u APPLE_API_ISSUER -u APPLE_API_KEY -u APPLE_API_KEY_PATH \
  -u TAURI_SIGNING_PRIVATE_KEY -u TAURI_SIGNING_PRIVATE_KEY_PATH -u TAURI_SIGNING_PRIVATE_KEY_PASSWORD \
  pnpm --filter desktop tauri build --target universal-apple-darwin --bundles app

APP="$TAURI_DIR/target/universal-apple-darwin/release/bundle/macos/$APP_NAME.app"
[[ -d $APP ]] || die "app bundle not found at $APP"

step "verify app bundle"
codesign --verify --deep --strict --verbose=2 "$APP"
exe=$(/usr/libexec/PlistBuddy -c "Print :CFBundleExecutable" "$APP/Contents/Info.plist")
archs=$(lipo -archs "$APP/Contents/MacOS/$exe")
[[ $archs == *x86_64* && $archs == *arm64* ]] || die "expected a universal binary, got: $archs"
bundle_version=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP/Contents/Info.plist")
[[ $bundle_version == "$version" ]] || die "bundle version $bundle_version does not match $version"
echo "archs: $archs, version: $bundle_version"

notarize_file() {
  local file=$1 log id
  log="$WORK/notarize-$(basename "$file").log"
  echo "submitting $(basename "$file") to the Apple notary service (waits for the result)"
  xcrun notarytool submit "$file" "${notary_auth[@]}" --wait | tee "$log" || true
  if ! grep -q 'status: Accepted' "$log"; then
    id=$(awk '$1 == "id:" { print $2 }' "$log" | tail -1)
    if [[ -n $id ]]; then
      xcrun notarytool log "$id" "${notary_auth[@]}" >&2 || true
    fi
    die "notarization of $(basename "$file") was not accepted"
  fi
}

if [[ $notarize -eq 1 ]]; then
  step "notarize and staple app"
  /usr/bin/ditto -c -k --keepParent "$APP" "$WORK/$APP_NAME.zip"
  notarize_file "$WORK/$APP_NAME.zip"
  xcrun stapler staple "$APP"
  xcrun stapler validate "$APP"
  spctl -a -t exec -vv "$APP"
fi

step "updater bundle"
# Packed after stapling, so updates ship the stapled app. The updater strips the
# first path component, so the archive root must be Angaria.app.
TARBALL="$REL/$APP_NAME.app.tar.gz"
COPYFILE_DISABLE=1 tar --no-mac-metadata -czf "$TARBALL" -C "$(dirname "$APP")" "$APP_NAME.app"
if tar -tzf "$TARBALL" | grep -E '(^|/)\._' >&2; then
  die "AppleDouble entries in $TARBALL"
fi
mkdir "$WORK/extract"
tar -xzf "$TARBALL" -C "$WORK/extract"
codesign --verify --deep --strict "$WORK/extract/$APP_NAME.app"
if [[ $notarize -eq 1 ]]; then
  xcrun stapler validate "$WORK/extract/$APP_NAME.app"
fi
# --app-version binds the signature to the version (plugins.updater.requireSignedVersion).
if [[ -n $key_path ]]; then
  env -u TAURI_SIGNING_PRIVATE_KEY TAURI_SIGNING_PRIVATE_KEY_PATH="$key_path" \
    pnpm --filter desktop tauri signer sign --app-version "$version" "$TARBALL"
else
  env -u TAURI_SIGNING_PRIVATE_KEY_PATH \
    pnpm --filter desktop tauri signer sign --app-version "$version" "$TARBALL"
fi
[[ -s $TARBALL.sig ]] || die "updater signature missing: $TARBALL.sig"

step "dmg"
DMG="$REL/${APP_NAME}_${version}_universal.dmg"
mkdir "$WORK/dmg"
/usr/bin/ditto "$APP" "$WORK/dmg/$APP_NAME.app"
ln -s /Applications "$WORK/dmg/Applications"
hdiutil create -volname "$APP_NAME" -srcfolder "$WORK/dmg" -fs HFS+ -format UDZO -ov "$DMG"
codesign --force --sign "$APPLE_SIGNING_IDENTITY" --timestamp "$DMG"
codesign --verify --strict --verbose=2 "$DMG"

if [[ $notarize -eq 1 ]]; then
  step "notarize and staple dmg"
  notarize_file "$DMG"
  xcrun stapler staple "$DMG"
  xcrun stapler validate "$DMG"
  spctl -a -t open --context context:primary-signature -vv "$DMG"
fi

step "updater manifest"
MANIFEST="$OUT/updates/latest.json"
RELEASE_VERSION="$version" \
  RELEASE_NOTES="${notes:-$APP_NAME $version}" \
  RELEASE_URL="$BASE_URL/releases/$version/$APP_NAME.app.tar.gz" \
  RELEASE_SIGNATURE="$(cat "$TARBALL.sig")" \
  node -e '
    const env = process.env;
    const platform = { signature: env.RELEASE_SIGNATURE, url: env.RELEASE_URL };
    const manifest = {
      version: env.RELEASE_VERSION,
      notes: env.RELEASE_NOTES,
      pub_date: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      platforms: { "darwin-aarch64": platform, "darwin-x86_64": platform },
    };
    process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
  ' >"$MANIFEST"
cat "$MANIFEST"

if [[ $publish -eq 1 ]]; then
  step "upload to R2 bucket $BUCKET"
  put() {
    echo "upload $1"
    wrangler r2 object put "$BUCKET/$1" --file "$2" --content-type "$3" --cache-control "$4" --remote
  }
  immutable="public, max-age=31536000, immutable"
  put "releases/$version/$(basename "$DMG")" "$DMG" application/x-apple-diskimage "$immutable"
  put "releases/$version/$APP_NAME.app.tar.gz" "$TARBALL" application/gzip "$immutable"
  put "releases/$version/$APP_NAME.app.tar.gz.sig" "$TARBALL.sig" text/plain "$immutable"
  put "latest/$APP_NAME.dmg" "$DMG" application/x-apple-diskimage "public, max-age=300"
  # Last, so the manifest never points at files that are not uploaded yet.
  put "updates/latest.json" "$MANIFEST" application/json "public, max-age=60"
fi

echo
echo "artifacts in $OUT:"
(cd "$OUT" && find . -type f | sed 's|^\./|  |' | sort)
echo
authority=$(codesign -dvv "$APP" 2>&1 | grep -m1 'Authority=' | sed 's/^Authority=//' || true)
echo "signed by: ${authority:-ad-hoc}"
if [[ $notarize -eq 1 ]]; then
  echo "notarized and stapled: app and dmg"
else
  echo "not notarized (--skip-notarize): local testing only"
fi
echo
if [[ $publish -eq 1 ]]; then
  echo "published:"
else
  echo "dry run, nothing uploaded. --publish would serve:"
fi
echo "  download  $BASE_URL/latest/$APP_NAME.dmg"
echo "  dmg       $BASE_URL/releases/$version/$(basename "$DMG")"
echo "  update    $BASE_URL/releases/$version/$APP_NAME.app.tar.gz"
echo "  manifest  $BASE_URL/updates/latest.json"
