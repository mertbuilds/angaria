//! The built-in MCP server's `mcp.json` in the app data dir: the bearer
//! token, the port while the server runs and the MCP page's settings, read by
//! the angaria-mcp bridge (docs/adr/0012-mcp-in-the-background.md).

use std::fs;
use std::io::{self, ErrorKind};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::secrets::write_file;

/// The bridge (mcp-bridge/src/main.rs) reads the same file and fields.
pub const STATE_FILE: &str = "mcp.json";

/// The port the MCP page starts with (src/lib/mcp.ts, MCP_DEFAULT_PORT).
pub const DEFAULT_PORT: u16 = 41234;

/// The MCP page's settings. The app is their source: the webview reads them
/// at launch and changes them through `mcp_set_settings`, the menu bar too.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
  #[serde(default)]
  pub enabled: bool,
  /// Ajanlar onaylayabilir ve silebilir (docs/adr/0010-mcp-agent-actions.md).
  #[serde(default)]
  pub allow_actions: bool,
  #[serde(default = "default_port")]
  pub port: u16,
  #[serde(default = "default_true")]
  pub show_in_menu_bar: bool,
}

fn default_port() -> u16 {
  DEFAULT_PORT
}

fn default_true() -> bool {
  true
}

impl Default for Settings {
  fn default() -> Self {
    Self {
      enabled: false,
      allow_actions: false,
      port: DEFAULT_PORT,
      show_in_menu_bar: true,
    }
  }
}

#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct State {
  #[serde(default)]
  pub token: String,
  /// Set while the server listens.
  #[serde(default)]
  pub port: Option<u16>,
  /// None until the webview first saved them (an install from before 0012
  /// keeps them in localStorage and moves them here on its next launch).
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub settings: Option<Settings>,
}

/// Every change reads the file and writes it whole: one at a time.
static FILE_LOCK: Mutex<()> = Mutex::new(());

fn state_path(dir: &Path) -> PathBuf {
  dir.join(STATE_FILE)
}

fn read_state(dir: &Path) -> io::Result<State> {
  match fs::read_to_string(state_path(dir)) {
    // An unreadable file starts over with a new token.
    Ok(text) => Ok(serde_json::from_str(&text).unwrap_or_default()),
    Err(error) if error.kind() == ErrorKind::NotFound => Ok(State::default()),
    Err(error) => Err(error),
  }
}

fn write_state(dir: &Path, state: &State) -> Result<(), String> {
  let json = serde_json::to_string_pretty(state).map_err(|error| error.to_string())?;
  write_file(&state_path(dir), &json)
}

/// 32 random bytes as hex.
fn new_token() -> Result<String, String> {
  let mut bytes = [0u8; 32];
  getrandom::fill(&mut bytes).map_err(|error| error.to_string())?;
  Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

/// The install's token, made on first use.
pub fn ensure_token(dir: &Path) -> Result<String, String> {
  let _lock = FILE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
  let mut state = read_state(dir).map_err(|error| error.to_string())?;
  if state.token.len() < 32 {
    state.token = new_token()?;
    write_state(dir, &state)?;
  }
  Ok(state.token)
}

/// Records the port the server listens on, or that it stopped.
pub fn set_port(dir: &Path, port: Option<u16>) -> Result<(), String> {
  let _lock = FILE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
  let mut state = read_state(dir).map_err(|error| error.to_string())?;
  if state.port == port {
    return Ok(());
  }
  state.port = port;
  write_state(dir, &state)
}

/// Forgets `port` once its server stopped, unless another instance took the file since.
pub fn clear_port(dir: &Path, port: u16) -> Result<(), String> {
  let _lock = FILE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
  let mut state = read_state(dir).map_err(|error| error.to_string())?;
  if state.port != Some(port) {
    return Ok(());
  }
  state.port = None;
  write_state(dir, &state)
}

/// The saved settings; None before the webview first saved them.
pub fn read_settings(dir: &Path) -> Option<Settings> {
  let _lock = FILE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
  read_state(dir).ok().and_then(|state| state.settings)
}

pub fn write_settings(dir: &Path, settings: &Settings) -> Result<(), String> {
  let _lock = FILE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
  let mut state = read_state(dir).map_err(|error| error.to_string())?;
  if state.settings.as_ref() == Some(settings) {
    return Ok(());
  }
  state.settings = Some(settings.clone());
  write_state(dir, &state)
}

#[cfg(test)]
mod tests {
  use super::*;

  fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("angaria-mcp-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
  }

  #[test]
  fn the_token_is_made_once_and_kept_private() {
    let dir = temp_dir("token");
    let token = ensure_token(&dir).unwrap();
    assert_eq!(token.len(), 64);
    assert!(token.chars().all(|c| c.is_ascii_hexdigit()));
    assert_eq!(ensure_token(&dir).unwrap(), token);
    set_port(&dir, Some(41234)).unwrap();
    assert_eq!(
      read_state(&dir).unwrap(),
      State {
        token: token.clone(),
        port: Some(41234),
        settings: None,
      }
    );
    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      let mode = fs::metadata(state_path(&dir)).unwrap().permissions().mode();
      assert_eq!(mode & 0o777, 0o600);
    }
    clear_port(&dir, 41235).unwrap();
    assert_eq!(read_state(&dir).unwrap().port, Some(41234));
    clear_port(&dir, 41234).unwrap();
    assert_eq!(read_state(&dir).unwrap().port, None);
    assert_eq!(read_state(&dir).unwrap().token, token);
    fs::remove_dir_all(dir).unwrap();
  }

  #[test]
  fn settings_keep_the_token_and_port_and_the_bridge_reads_them() {
    let dir = temp_dir("settings");
    let token = ensure_token(&dir).unwrap();
    set_port(&dir, Some(41235)).unwrap();
    assert_eq!(read_settings(&dir), None);
    let settings = Settings {
      enabled: true,
      allow_actions: true,
      port: 41235,
      show_in_menu_bar: false,
    };
    write_settings(&dir, &settings).unwrap();
    assert_eq!(read_settings(&dir), Some(settings));
    let state = read_state(&dir).unwrap();
    assert_eq!((state.token, state.port), (token, Some(41235)));
    let raw: serde_json::Value =
      serde_json::from_str(&fs::read_to_string(state_path(&dir)).unwrap()).unwrap();
    assert_eq!(raw["settings"]["enabled"], true);
    assert_eq!(raw["settings"]["showInMenuBar"], false);
    fs::remove_dir_all(dir).unwrap();
  }

  #[test]
  fn settings_missing_fields_take_their_defaults() {
    let dir = temp_dir("settings-defaults");
    fs::write(state_path(&dir), r#"{"token":"","settings":{"enabled":true}}"#).unwrap();
    assert_eq!(
      read_settings(&dir),
      Some(Settings {
        enabled: true,
        ..Settings::default()
      })
    );
    fs::remove_dir_all(dir).unwrap();
  }
}
