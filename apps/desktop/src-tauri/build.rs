fn main() {
  tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
    tauri_build::AppManifest::new().commands(&["secret_set", "secret_get", "secret_delete"]),
  ))
  .expect("failed to run tauri-build");
}
