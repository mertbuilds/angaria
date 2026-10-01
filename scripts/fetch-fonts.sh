#!/usr/bin/env bash
# Fetch licensed Suisse Intl (400 and 500 only) from the private R2 bucket:
# woff2 for the apps' CSS. The bucket holds woff2 only, so the TrueType files
# the desktop app's PDFs embed (react-pdf cannot embed woff2) are decompressed
# from them here (wawoff2, lossless).
# Never blocks: without bucket access (or on any failure) the apps fall back to
# Inter, so this exits 0 with a warning.
# Needs wrangler auth: an OAuth login locally, CLOUDFLARE_API_TOKEN in CI.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/packages/ui/fonts"
BUCKET="${FONT_BUCKET:-suisse-font}"
NAMES=(SuisseIntl-Regular SuisseIntl-Medium)

if [[ -n ${CI:-} && -z ${CLOUDFLARE_API_TOKEN:-} ]]; then
  echo "warn: CLOUDFLARE_API_TOKEN not set, Suisse Intl not fetched, Inter fallback active."
  exit 0
fi

mkdir -p "$DEST"
failed=0
for name in "${NAMES[@]}"; do
  woff2="$DEST/$name.woff2"
  ttf="$DEST/$name.ttf"
  if [[ -s $woff2 ]]; then
    echo "have $name.woff2"
  elif (cd "$ROOT/apps/web" && pnpm exec wrangler r2 object get "$BUCKET/$name.woff2" --file "$woff2.part" --remote >/dev/null 2>&1) && [[ -s $woff2.part ]]; then
    mv "$woff2.part" "$woff2"
    echo "fetched $name.woff2"
  else
    rm -f "$woff2.part"
    echo "warn: failed to fetch $name.woff2"
    failed=1
    continue
  fi

  if [[ -s $ttf && ! $woff2 -nt $ttf ]]; then
    echo "have $name.ttf"
  elif (cd "$ROOT" && node -e '
    const fs = require("node:fs");
    const { decompress } = require("wawoff2");
    const [from, to] = process.argv.slice(1);
    decompress(fs.readFileSync(from)).then((font) => fs.writeFileSync(to, font));
  ' "$woff2" "$ttf.part" 2>/dev/null) && [[ -s $ttf.part ]]; then
    mv "$ttf.part" "$ttf"
    echo "derived $name.ttf"
  else
    rm -f "$ttf.part"
    echo "warn: failed to derive $name.ttf from $name.woff2"
    failed=1
  fi
done

if [[ $failed -eq 1 ]]; then
  echo "warn: Suisse Intl not (fully) fetched, Inter fallback active."
fi
exit 0
