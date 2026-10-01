#!/usr/bin/env bash
# Fetch licensed Suisse Intl woff2 files (400 and 500 only) from a private bucket.
# Never blocks: without FONT_BUCKET_URL (or on any download failure) the apps
# fall back to Inter, so this exits 0 with a warning.
set -uo pipefail

DEST="$(cd "$(dirname "$0")/.." && pwd)/packages/ui/fonts"
FILES=(SuisseIntl-Regular.woff2 SuisseIntl-Medium.woff2)

if [[ -z "${FONT_BUCKET_URL:-}" ]]; then
  echo "warn: FONT_BUCKET_URL not set, Suisse Intl not fetched, Inter fallback active."
  exit 0
fi

mkdir -p "$DEST"
failed=0
for file in "${FILES[@]}"; do
  if curl -fsSL "${FONT_BUCKET_URL%/}/$file" -o "$DEST/$file"; then
    echo "fetched $file"
  else
    echo "warn: failed to fetch $file"
    failed=1
  fi
done

if [[ $failed -eq 1 ]]; then
  echo "warn: Suisse Intl not (fully) fetched, Inter fallback active."
fi
exit 0
