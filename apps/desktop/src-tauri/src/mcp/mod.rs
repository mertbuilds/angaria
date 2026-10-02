//! The built-in MCP server (docs/adr/0009-built-in-mcp-server.md): the HTTP
//! side lives here, the tools run in the webview (src/lib/mcp-tools.ts), so
//! they share the app's GİB session queue, credentials and store. A call goes
//! out as the `mcp:call` event and comes back through `mcp_respond`.

pub mod files;
pub mod rpc;
pub mod server;

use std::path::PathBuf;
use std::sync::Arc;
use std::time::SystemTime;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{oneshot, Mutex};

use files::{ClientApp, Installed};
use server::{ClientSeen, Pending, RunningServer, ServerOptions, ToolCall, ToolHost};

/// The stdio bridge next to the app's executable (bundle.externalBin).
pub const BRIDGE_NAME: &str = if cfg!(windows) {
  "angaria-mcp.exe"
} else {
  "angaria-mcp"
};
/// Ports tried from the chosen one on when it is taken.
const PORT_ATTEMPTS: u16 = 10;

/// Sends tool calls to the webview and waits for `mcp_respond`.
struct WebviewHost {
  app: AppHandle,
  pending: Pending,
}

impl ToolHost for WebviewHost {
  fn dispatch(&self, call: ToolCall) -> oneshot::Receiver<Value> {
    let receiver = self.pending.add(call.id);
    if let Err(error) = self.app.emit("mcp:call", &call) {
      log::error!("MCP: could not hand call {} to the webview: {error}", call.id);
      // Dropping the sender fails the call at once.
      self.pending.remove(call.id);
    }
    receiver
  }

  fn cancel(&self, id: u64) {
    self.pending.remove(id);
    let _ = self.app.emit("mcp:cancel", id);
  }
}

pub struct McpState {
  server: Mutex<Option<RunningServer>>,
  host: Arc<WebviewHost>,
  dir: PathBuf,
}

impl McpState {
  pub fn new(app: AppHandle, dir: PathBuf) -> Self {
    Self {
      server: Mutex::new(None),
      host: Arc::new(WebviewHost {
        app,
        pending: Pending::default(),
      }),
      dir,
    }
  }

  /// The app is quitting: the bridge must not find the port in mcp.json.
  pub fn forget_port(&self) {
    if let Ok(slot) = self.server.try_lock() {
      if let Some(running) = slot.as_ref() {
        let _ = files::clear_port(&self.dir, running.port());
      }
    }
  }
}

fn bridge_path() -> PathBuf {
  std::env::current_exe()
    .ok()
    .and_then(|exe| exe.parent().map(|dir| dir.join(BRIDGE_NAME)))
    .unwrap_or_else(|| PathBuf::from(BRIDGE_NAME))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
  running: bool,
  port: Option<u16>,
  bridge_path: String,
  bridge_found: bool,
  clients: Vec<ClientSeen>,
}

fn status_of(server: Option<&RunningServer>) -> McpStatus {
  let bridge = bridge_path();
  McpStatus {
    running: server.is_some(),
    port: server.map(RunningServer::port),
    bridge_found: bridge.is_file(),
    bridge_path: bridge.display().to_string(),
    clients: server.map(RunningServer::clients).unwrap_or_default(),
  }
}

/// Starts the server on `port` (or the next free one) with the tools the
/// webview runs. Running already: takes the new tools, restarts for a new port.
#[tauri::command]
pub async fn mcp_start(
  state: State<'_, McpState>,
  port: u16,
  tools: Value,
) -> Result<McpStatus, String> {
  if port < 1024 {
    return Err("Port 1024 ile 65535 arasında olmalı.".into());
  }
  let mut slot = state.server.lock().await;
  if let Some(running) = slot.as_ref() {
    if running.requested_port == port {
      running.set_tools(tools);
      return Ok(status_of(Some(running)));
    }
  }
  if let Some(running) = slot.take() {
    let port = running.port();
    running.stop().await;
    files::clear_port(&state.dir, port)?;
  }
  let token = files::ensure_token(&state.dir)
    .map_err(|error| format!("MCP erişim anahtarı kaydedilemedi: {error}"))?;
  let host: Arc<dyn ToolHost> = state.host.clone();
  let running = server::start(ServerOptions {
    port,
    attempts: PORT_ATTEMPTS,
    token,
    tools,
    host,
    server_version: env!("CARGO_PKG_VERSION").into(),
  })
  .await
  .map_err(|error| {
    log::error!("MCP: could not listen from port {port}: {error}");
    format!(
      "{port} ve sonraki {} port dolu. Gelişmiş’ten başka bir port seç.",
      PORT_ATTEMPTS - 1
    )
  })?;
  if let Err(error) = files::set_port(&state.dir, Some(running.port())) {
    running.stop().await;
    return Err(format!("MCP sunucusunun bilgisi kaydedilemedi: {error}"));
  }
  let status = status_of(Some(&running));
  *slot = Some(running);
  Ok(status)
}

#[tauri::command]
pub async fn mcp_stop(state: State<'_, McpState>) -> Result<(), String> {
  let mut slot = state.server.lock().await;
  if let Some(running) = slot.take() {
    let port = running.port();
    running.stop().await;
    files::clear_port(&state.dir, port)?;
  }
  Ok(())
}

#[tauri::command]
pub async fn mcp_status(state: State<'_, McpState>) -> Result<McpStatus, String> {
  Ok(status_of(state.server.lock().await.as_ref()))
}

/// The webview's CallToolResult for call `id`.
#[tauri::command]
pub async fn mcp_respond(state: State<'_, McpState>, id: u64, result: Value) -> Result<(), String> {
  // A call the server stopped waiting for is dropped.
  state.host.pending.resolve(id, result);
  Ok(())
}

/// The bearer token, for the HTTP setup command.
#[tauri::command]
pub async fn mcp_token(state: State<'_, McpState>) -> Result<String, String> {
  files::ensure_token(&state.dir)
}

#[tauri::command]
pub async fn mcp_rotate_token(state: State<'_, McpState>) -> Result<String, String> {
  let slot = state.server.lock().await;
  let token = files::rotate_token(&state.dir)?;
  if let Some(running) = slot.as_ref() {
    running.set_token(token.clone());
  }
  Ok(token)
}

/// Adds the bridge to an MCP client's config file: `claude-desktop` or `cursor`.
#[tauri::command]
pub async fn mcp_install(state: State<'_, McpState>, client: String) -> Result<Installed, String> {
  let app = ClientApp::parse(&client).ok_or("Bilinmeyen uygulama.")?;
  let bridge = bridge_path();
  if !bridge.is_file() {
    return Err("Angaria’nın MCP köprüsü bulunamadı. Angaria’yı yeniden kur.".into());
  }
  let home = state
    .host
    .app
    .path()
    .home_dir()
    .map_err(|error| error.to_string())?;
  files::install(app, &app.config_path(&home), &bridge, SystemTime::now())
}
