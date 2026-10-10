//! The built-in MCP server's `mcp.json` in the app data dir: the bearer
//! token and the port while the server runs, read by the angaria-mcp bridge.

use std::fs;
use std::io::{self, ErrorKind};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::secrets::write_file;

/// The bridge (mcp-bridge/src/main.rs) reads the same file and fields.
pub const STATE_FILE: &str = "mcp.json";

#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct State {
  #[serde(default)]
  pub token: String,
  /// Set while the server listens.
  #[serde(default)]
  pub port: Option<u16>,
}

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
  let mut state = read_state(dir).map_err(|error| error.to_string())?;
  if state.token.len() < 32 {
    state.token = new_token()?;
    write_state(dir, &state)?;
  }
  Ok(state.token)
}

/// A new token; clients added with the old one in a header stop working.
pub fn rotate_token(dir: &Path) -> Result<String, String> {
  let mut state = read_state(dir).map_err(|error| error.to_string())?;
  state.token = new_token()?;
  write_state(dir, &state)?;
  Ok(state.token)
}

/// Records the port the server listens on, or that it stopped.
pub fn set_port(dir: &Path, port: Option<u16>) -> Result<(), String> {
  let mut state = read_state(dir).map_err(|error| error.to_string())?;
  if state.port == port {
    return Ok(());
  }
  state.port = port;
  write_state(dir, &state)
}

/// Forgets `port` once its server stopped, unless another instance took the file since.
pub fn clear_port(dir: &Path, port: u16) -> Result<(), String> {
  let mut state = read_state(dir).map_err(|error| error.to_string())?;
  if state.port != Some(port) {
    return Ok(());
  }
  state.port = None;
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
        port: Some(41234)
      }
    );
    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      let mode = fs::metadata(state_path(&dir)).unwrap().permissions().mode();
      assert_eq!(mode & 0o777, 0o600);
    }
    let rotated = rotate_token(&dir).unwrap();
    assert_ne!(rotated, token);
    assert_eq!(read_state(&dir).unwrap().port, Some(41234));
    clear_port(&dir, 41235).unwrap();
    assert_eq!(read_state(&dir).unwrap().port, Some(41234));
    clear_port(&dir, 41234).unwrap();
    assert_eq!(read_state(&dir).unwrap().port, None);
    assert_eq!(read_state(&dir).unwrap().token, rotated);
    fs::remove_dir_all(dir).unwrap();
  }
}
