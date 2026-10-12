mod background;
mod downloads;
pub mod mcp;
pub mod pdf;
mod quit;
mod secrets;
mod tray;

use tauri::Manager;
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_autostart::init(
      MacosLauncher::LaunchAgent,
      Some(vec![background::BACKGROUND_ARG]),
    ))
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
      let launch = background::parse_args(std::env::args());
      app.manage(background::Background::new(launch));
      app.manage(quit::Quit::default());
      #[cfg(target_os = "macos")]
      quit::set_menu(app.handle())?;
      app.manage(mcp::McpState::new(
        app.handle().clone(),
        app.path().app_data_dir()?,
      ));
      tray::create(app.handle())?;
      // The login item names the app by its path: a moved app gets it renewed.
      let autolaunch = app.autolaunch();
      if autolaunch.is_enabled().unwrap_or(false) {
        if let Err(error) = autolaunch.enable() {
          log::error!("could not renew launch at login: {error}");
        }
      }
      // The window starts hidden (tauri.conf.json); a background launch keeps
      // it so, without a Dock icon, and the webview still loads for MCP.
      if launch.background {
        #[cfg(target_os = "macos")]
        app.set_activation_policy(tauri::ActivationPolicy::Accessory);
      } else {
        background::show_window(app.handle(), None);
      }
      #[cfg(desktop)]
      app
        .handle()
        .plugin(tauri_plugin_updater::Builder::new().build())?;
      Ok(())
    })
    // A reload drops the MCP calls the page ran; agents hear it at once.
    .on_page_load(|webview, payload| {
      if payload.event() == tauri::webview::PageLoadEvent::Started {
        if let Some(mcp) = webview.try_state::<mcp::McpState>() {
          mcp.page_loading();
        }
      }
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
      mcp::mcp_settings,
      mcp::mcp_set_settings,
      tray::tray_set_activity,
      background::window_close_requested,
      quit::quit_ready,
      pdf::html_to_pdf,
      downloads::save_download
    ])
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app, event| match event {
      // Opened from a background launch: quits when MCP turned out to be off.
      tauri::RunEvent::Ready => {
        let settings = app.state::<mcp::McpState>().settings();
        background::settings_changed(app, settings.as_ref());
      }
      // The Dock icon, Finder, Spotlight or `open` while the app runs.
      #[cfg(target_os = "macos")]
      tauri::RunEvent::Reopen { .. } => background::show_window(app, None),
      // Çık, ⌘Q and a background quit wait for the webview's GİB logout.
      tauri::RunEvent::ExitRequested { code, api, .. } => quit::exit_requested(app, code, &api),
      tauri::RunEvent::Exit => {
        if let Some(mcp) = app.try_state::<mcp::McpState>() {
          mcp.forget_port();
        }
      }
      _ => {}
    });
}
