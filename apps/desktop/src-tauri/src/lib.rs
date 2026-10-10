mod downloads;
pub mod mcp;
pub mod pdf;
mod secrets;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_process::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      let store = secrets::VaultStore::for_build(|| app.path().app_data_dir())?;
      app.manage(store);
      app.manage(mcp::McpState::new(
        app.handle().clone(),
        app.path().app_data_dir()?,
      ));
      #[cfg(desktop)]
      app
        .handle()
        .plugin(tauri_plugin_updater::Builder::new().build())?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      secrets::vault_read,
      secrets::vault_write,
      secrets::secret_get,
      secrets::secret_delete,
      mcp::mcp_start,
      mcp::mcp_stop,
      mcp::mcp_status,
      mcp::mcp_respond,
      mcp::mcp_token,
      mcp::mcp_rotate_token,
      mcp::mcp_agents,
      mcp::mcp_agents_add,
      mcp::mcp_agents_remove,
      pdf::html_to_pdf,
      downloads::save_download
    ])
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app, event| {
      if let (tauri::RunEvent::Exit, Some(mcp)) = (event, app.try_state::<mcp::McpState>()) {
        mcp.forget_port();
      }
    });
}
