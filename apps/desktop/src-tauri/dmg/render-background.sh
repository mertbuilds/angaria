#!/usr/bin/env bash
# Render background.html to the pictures the install window shows:
# background.png (660x480) and background@2x.png (1320x960). dmgbuild picks up
# the @2x file beside the 1x one; Tauri's dmg bundler takes the 1x only.
#
#   bash apps/desktop/src-tauri/dmg/render-background.sh
#
# The pictures are tracked, so a release does not run this. Run it after a
# change to the html and commit the result. It needs Google Chrome (or CHROME
# pointed at any Chromium); the browser runs on its own throwaway profile.

set -euo pipefail

cd "$(dirname "$0")"

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
if [ ! -x "$CHROME" ]; then
  echo "error: no browser at $CHROME. point CHROME at a Chromium binary." >&2
  exit 1
fi

PROFILE=$(mktemp -d)
trap 'rm -rf "$PROFILE"' EXIT

# Chrome writes the picture and then does not always quit, so it runs beside
# the script and is stopped once the file is there. Its page is shorter than
# the window it is asked for and it fills the rest with a repeat of the top, so
# the window is taller than the art and the picture is cut back to the art.
# sips reads a crop offset of 0 as "center", so the picture gets a 1px frame
# first and the cut starts at 1.
WIDTH=660
HEIGHT=480
SPARE=200

render() {
  local scale=$1 out=$2 browser waited=0
  local w=$((WIDTH * scale)) h=$((HEIGHT * scale)) tall=$(((HEIGHT + SPARE) * scale))
  rm -f "$out"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
    --user-data-dir="$PROFILE" --window-size="$WIDTH,$((HEIGHT + SPARE))" \
    --force-device-scale-factor="$scale" --virtual-time-budget=2000 \
    --screenshot="$(pwd)/$out" "file://$(pwd)/background.html" >/dev/null 2>&1 &
  browser=$!
  until [ -s "$out" ] || [ "$waited" -ge 60 ]; do
    sleep 1
    waited=$((waited + 1))
  done
  sleep 1
  kill "$browser" 2>/dev/null || true
  wait "$browser" 2>/dev/null || true
  if [ ! -s "$out" ]; then
    echo "error: the browser did not write $out" >&2
    exit 1
  fi
  sips -p $((tall + 2)) $((w + 2)) "$out" >/dev/null
  sips --cropOffset 1 1 -c "$h" "$w" "$out" >/dev/null
  echo "  $out: $(sips -g pixelWidth -g pixelHeight "$out" | awk '/pixel/ {print $2}' | paste -sd x -)"
}

echo "==> render dmg background"
render 1 background.png
render 2 background@2x.png
