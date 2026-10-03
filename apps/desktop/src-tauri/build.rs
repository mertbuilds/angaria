use std::path::Path;

fn main() {
  // bundle.externalBin: tauri-build copies the stdio bridge next to the app's
  // binary and fails with a bare "path doesn't exist" when it was not built.
  let target = std::env::var("TARGET").unwrap();
  let suffix = if target.contains("windows") { ".exe" } else { "" };
  let bridge = format!("binaries/angaria-mcp-{target}{suffix}");
  println!("cargo:rerun-if-changed={bridge}");
  if !Path::new(&bridge).exists() {
    panic!(
      "{bridge} is missing: run `pnpm --filter desktop mcp-bridge` first \
       (tauri dev and tauri build run it themselves)"
    );
  }

  tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
    tauri_build::AppManifest::new().commands(&[
      "vault_read",
      "vault_write",
      "secret_get",
      "secret_delete",
      "mcp_start",
      "mcp_stop",
      "mcp_status",
      "mcp_respond",
      "mcp_token",
      "mcp_rotate_token",
      "mcp_install",
      "html_to_pdf",
      "save_download",
    ]),
  ))
  .expect("failed to run tauri-build");
}
