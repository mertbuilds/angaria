//! Files of the built-in MCP server: `mcp.json` in the app data dir (the
//! bearer token and the port while the server runs, read by the angaria-mcp
//! bridge), and the MCP client configs the setup buttons write.

use std::fs;
use std::io::{self, ErrorKind};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use crate::secrets::write_file;

/// The bridge (mcp-bridge/src/main.rs) reads the same file and fields.
pub const STATE_FILE: &str = "mcp.json";
/// The name the app has in every MCP client config.
pub const SERVER_KEY: &str = "angaria";

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

/// MCP clients whose config file the app can add itself to.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ClientApp {
  ClaudeDesktop,
  Cursor,
}

impl ClientApp {
  pub fn parse(name: &str) -> Option<Self> {
    match name {
      "claude-desktop" => Some(Self::ClaudeDesktop),
      "cursor" => Some(Self::Cursor),
      _ => None,
    }
  }

  fn label(self) -> &'static str {
    match self {
      Self::ClaudeDesktop => "Claude Desktop",
      Self::Cursor => "Cursor",
    }
  }

  /// The user-level config file, under `home`.
  pub fn config_path(self, home: &Path) -> PathBuf {
    match self {
      Self::ClaudeDesktop if cfg!(target_os = "macos") => {
        home.join("Library/Application Support/Claude/claude_desktop_config.json")
      }
      Self::ClaudeDesktop if cfg!(windows) => std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join("AppData/Roaming"))
        .join("Claude/claude_desktop_config.json"),
      Self::ClaudeDesktop => home.join(".config/Claude/claude_desktop_config.json"),
      Self::Cursor => home.join(".cursor/mcp.json"),
    }
  }
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Installed {
  pub path: String,
  /// The copy of the file from before the change, when there was a file.
  pub backup: Option<String>,
  /// The config already named the bridge: nothing was written.
  pub unchanged: bool,
}

/// `days` since 1970-01-01 as (year, month, day), proleptic Gregorian.
fn civil_from_days(days: i64) -> (i64, u32, u32) {
  let z = days + 719_468;
  let era = z.div_euclid(146_097);
  let doe = z.rem_euclid(146_097);
  let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
  let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  let mp = (5 * doy + 2) / 153;
  let day = (doy - (153 * mp + 2) / 5 + 1) as u32;
  let month = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
  let year = yoe + era * 400 + i64::from(month <= 2);
  (year, month, day)
}

/// "20261002-154500" in UTC, for backup names.
fn stamp(now: SystemTime) -> String {
  let seconds = now
    .duration_since(UNIX_EPOCH)
    .map(|time| time.as_secs() as i64)
    .unwrap_or(0);
  let (year, month, day) = civil_from_days(seconds.div_euclid(86_400));
  let time = seconds.rem_euclid(86_400);
  format!(
    "{year:04}{month:02}{day:02}-{:02}{:02}{:02}",
    time / 3_600,
    time % 3_600 / 60,
    time % 60
  )
}

/// The config with `mcpServers.angaria` running `bridge`, other entries kept.
fn merged_config(text: Option<&str>, bridge: &str) -> Result<(Value, bool), String> {
  let mut config = match text.map(str::trim) {
    None | Some("") => Value::Object(Map::new()),
    Some(text) => serde_json::from_str::<Value>(text).map_err(|_| {
      "Ayar dosyası geçerli JSON değil. Dosyayı düzelt ya da sil, sonra tekrar dene.".to_string()
    })?,
  };
  let Some(root) = config.as_object_mut() else {
    return Err("Ayar dosyası beklenen biçimde değil: en dışta bir JSON nesnesi olmalı.".into());
  };
  let servers = root
    .entry("mcpServers")
    .or_insert_with(|| Value::Object(Map::new()));
  let Some(servers) = servers.as_object_mut() else {
    return Err("Ayar dosyasındaki mcpServers bir JSON nesnesi değil. Dosyayı düzelt.".into());
  };
  let entry = json!({ "command": bridge, "args": [] });
  if servers.get(SERVER_KEY) == Some(&entry) {
    return Ok((config, false));
  }
  servers.insert(SERVER_KEY.into(), entry);
  Ok((config, true))
}

/// Adds the bridge to `app`'s config at `path`: backs the file up first,
/// keeps every other setting, and writes the new file in one rename.
pub fn install(
  app: ClientApp,
  path: &Path,
  bridge: &Path,
  now: SystemTime,
) -> Result<Installed, String> {
  let Some(dir) = path.parent().filter(|dir| dir.is_dir()) else {
    return Err(format!(
      "{} bu Mac’te kurulu görünmüyor. Kurup bir kez açtıktan sonra tekrar dene.",
      app.label()
    ));
  };
  let existing = match fs::read_to_string(path) {
    Ok(text) => Some(text),
    Err(error) if error.kind() == ErrorKind::NotFound => None,
    Err(error) => return Err(format!("Ayar dosyası okunamadı: {error}")),
  };
  let bridge = bridge
    .to_str()
    .ok_or("Angaria’nın yolu okunamadı.")?
    .to_string();
  let (config, changed) = merged_config(existing.as_deref(), &bridge)?;
  let path_text = path.display().to_string();
  if !changed {
    return Ok(Installed {
      path: path_text,
      backup: None,
      unchanged: true,
    });
  }
  let backup = match &existing {
    Some(text) => {
      let name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default();
      let backup = dir.join(format!("{name}.angaria-yedek-{}", stamp(now)));
      fs::write(&backup, text).map_err(|error| format!("Yedek alınamadı: {error}"))?;
      Some(backup.display().to_string())
    }
    None => None,
  };
  let mut json = serde_json::to_string_pretty(&config).map_err(|error| error.to_string())?;
  json.push('\n');
  let temp = path.with_extension("json.angaria-tmp");
  fs::write(&temp, json).map_err(|error| format!("Ayar dosyası yazılamadı: {error}"))?;
  if let Ok(metadata) = fs::metadata(path) {
    let _ = fs::set_permissions(&temp, metadata.permissions());
  }
  fs::rename(&temp, path).map_err(|error| format!("Ayar dosyası yazılamadı: {error}"))?;
  Ok(Installed {
    path: path_text,
    backup,
    unchanged: false,
  })
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::time::Duration;

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

  #[test]
  fn backup_names_are_utc_timestamps() {
    let at = UNIX_EPOCH + Duration::from_secs(1_791_301_500);
    assert_eq!(stamp(at), "20261006-154500");
    assert_eq!(stamp(UNIX_EPOCH), "19700101-000000");
    assert_eq!(civil_from_days(19_782), (2024, 2, 29));
  }

  #[test]
  fn merging_keeps_other_servers_and_settings() {
    let text = r#"{"globalShortcut":"Cmd+Space","mcpServers":{"other":{"command":"x"}}}"#;
    let (config, changed) = merged_config(Some(text), "/A/angaria-mcp").unwrap();
    assert!(changed);
    assert_eq!(config["globalShortcut"], "Cmd+Space");
    assert_eq!(config["mcpServers"]["other"]["command"], "x");
    assert_eq!(
      config["mcpServers"]["angaria"],
      json!({ "command": "/A/angaria-mcp", "args": [] })
    );
    let keys: Vec<_> = config.as_object().unwrap().keys().cloned().collect();
    assert_eq!(keys, ["globalShortcut", "mcpServers"]);

    let again = serde_json::to_string(&config).unwrap();
    assert!(!merged_config(Some(&again), "/A/angaria-mcp").unwrap().1);
    assert!(merged_config(Some(&again), "/B/angaria-mcp").unwrap().1);
  }

  #[test]
  fn merging_refuses_files_it_would_break() {
    assert!(merged_config(Some("{ nope"), "/a").is_err());
    assert!(merged_config(Some("[]"), "/a").is_err());
    assert!(merged_config(Some(r#"{"mcpServers":[]}"#), "/a").is_err());
    assert!(merged_config(Some("  "), "/a").unwrap().1);
    assert!(merged_config(None, "/a").unwrap().1);
  }

  #[test]
  fn install_backs_up_then_writes() {
    let dir = temp_dir("install");
    let path = dir.join("claude_desktop_config.json");
    let original = r#"{"mcpServers":{"other":{"command":"x"}}}"#;
    fs::write(&path, original).unwrap();
    let bridge = Path::new("/Applications/Angaria.app/Contents/MacOS/angaria-mcp");
    let at = UNIX_EPOCH + Duration::from_secs(1_791_301_500);

    let installed = install(ClientApp::ClaudeDesktop, &path, bridge, at).unwrap();
    let backup = installed.backup.clone().unwrap();
    assert!(backup.ends_with("claude_desktop_config.json.angaria-yedek-20261006-154500"));
    assert_eq!(fs::read_to_string(&backup).unwrap(), original);
    let written: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(written["mcpServers"]["angaria"]["command"], bridge.to_str().unwrap());
    assert_eq!(written["mcpServers"]["other"]["command"], "x");

    let again = install(ClientApp::ClaudeDesktop, &path, bridge, at).unwrap();
    assert!(again.unchanged);
    assert!(again.backup.is_none());
    fs::remove_dir_all(dir).unwrap();
  }

  #[test]
  fn install_needs_the_client_installed_and_valid_json() {
    let dir = temp_dir("install-missing");
    let bridge = Path::new("/a/angaria-mcp");
    let missing = dir.join("no-such-dir/mcp.json");
    assert!(install(ClientApp::Cursor, &missing, bridge, SystemTime::now())
      .unwrap_err()
      .contains("Cursor"));

    let path = dir.join("mcp.json");
    let created = install(ClientApp::Cursor, &path, bridge, SystemTime::now()).unwrap();
    assert!(created.backup.is_none());
    assert!(path.exists());

    fs::write(&path, "{ broken").unwrap();
    assert!(install(ClientApp::Cursor, &path, bridge, SystemTime::now()).is_err());
    assert_eq!(fs::read_to_string(&path).unwrap(), "{ broken");
    fs::remove_dir_all(dir).unwrap();
  }

  #[test]
  fn client_names_and_paths() {
    assert_eq!(ClientApp::parse("cursor"), Some(ClientApp::Cursor));
    assert_eq!(ClientApp::parse("claude-desktop"), Some(ClientApp::ClaudeDesktop));
    assert_eq!(ClientApp::parse("vscode"), None);
    let home = Path::new("/Users/test");
    assert_eq!(
      ClientApp::Cursor.config_path(home),
      Path::new("/Users/test/.cursor/mcp.json")
    );
    #[cfg(target_os = "macos")]
    assert_eq!(
      ClientApp::ClaudeDesktop.config_path(home),
      Path::new("/Users/test/Library/Application Support/Claude/claude_desktop_config.json")
    );
  }
}
