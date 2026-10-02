#!/usr/bin/env bash
# Builds the angaria-mcp stdio bridge (apps/desktop/src-tauri/mcp-bridge) into
# src-tauri/binaries/angaria-mcp-<target triple>, where Tauri's
# bundle.externalBin takes it from. On macOS it builds both architectures and
# the universal binary `tauri build --target universal-apple-darwin` bundles.
# Tauri's beforeDevCommand and beforeBuildCommand run it; so does
# `pnpm --filter desktop mcp-bridge` before a bare cargo check.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_DIR="$ROOT/apps/desktop/src-tauri"
OUT="$TAURI_DIR/binaries"
# Its own target dir: tauri-build copies the bridge into the app's target dir
# under the same name, which would overwrite cargo's output there.
export CARGO_TARGET_DIR="$TAURI_DIR/target/mcp-bridge"

if [[ -d $HOME/.cargo/bin ]]; then
  PATH="$HOME/.cargo/bin:$PATH"
fi

# Replaces $2 only when the content changed, so tauri-build does not rerun.
place() {
  if ! cmp -s "$1" "$2"; then
    cp "$1" "$2"
  fi
}

build() {
  local target=$1 suffix=${2:-}
  cargo build --package angaria-mcp --release --target "$target" --quiet
  place "$CARGO_TARGET_DIR/$target/release/angaria-mcp$suffix" "$OUT/angaria-mcp-$target$suffix"
}

mkdir -p "$OUT"
# rustup reads rust-toolchain.toml (both macOS targets) from the working directory.
cd "$TAURI_DIR"
if [[ $(uname -s) == Darwin ]]; then
  build aarch64-apple-darwin
  build x86_64-apple-darwin
  lipo -create -output "$CARGO_TARGET_DIR/angaria-mcp-universal" \
    "$OUT/angaria-mcp-aarch64-apple-darwin" "$OUT/angaria-mcp-x86_64-apple-darwin"
  place "$CARGO_TARGET_DIR/angaria-mcp-universal" "$OUT/angaria-mcp-universal-apple-darwin"
else
  host=$(rustc -vV | sed -n 's/^host: //p')
  suffix=""
  if [[ $host == *windows* ]]; then
    suffix=".exe"
  fi
  build "$host" "$suffix"
fi
