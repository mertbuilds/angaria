fn main() {
  tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
    tauri_build::AppManifest::new().commands(&[
      "vault_read",
      "vault_write",
      "secret_get",
      "secret_delete",
    ]),
  ))
  .expect("failed to run tauri-build");
}
