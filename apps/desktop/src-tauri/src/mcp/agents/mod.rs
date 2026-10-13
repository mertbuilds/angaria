//! The MCP clients ("agents") Angaria adds its stdio bridge to: where each
//! keeps its user-level config, the shape of its stdio entry, and how to tell
//! it is installed. Only global configs, only the bridge, always as "angaria".
//!
//! Ported from add-mcp 2.4.1 (https://github.com/neon-solutions/add-mcp,
//! Apache-2.0, Copyright 2025 Andre Landgraf; notice in THIRD_PARTY_NOTICES.md):
//! the agent table of src/agents.ts (table.rs), the format writers of
//! src/formats/ and src/opencode-config.ts (json.rs, toml.rs, yaml.rs, and
//! `opencode_servers` here), and the per-agent `{ success, path, error }`
//! results of `upsertServer` / `removeServer` in src/lib.ts. Why, what differs
//! and how to resync: docs/adr/0011-mcp-clients-from-add-mcp.md and
//! scripts/sync-add-mcp.md.

mod claude;
mod json;
mod table;
mod toml;
mod yaml;

use std::fs::{self, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use table::Format;
pub use table::{Agent, Env, AGENTS};

/// The name the app has in every MCP client config.
pub const SERVER_KEY: &str = "angaria";

fn malformed() -> String {
  "Ayar dosyası bozuk, Angaria dosyaya dokunmadı. Dosyayı düzeltip tekrar dene.".into()
}

fn unexpected() -> String {
  "Ayar dosyası beklenen biçimde değil, Angaria dosyaya dokunmadı. Dosyayı düzeltip tekrar dene."
    .into()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatus {
  pub id: &'static str,
  pub name: &'static str,
  /// The agent looks installed for this user.
  pub installed: bool,
  pub config_path: String,
  /// Its config already has an "angaria" server.
  pub our_server_installed: bool,
  /// Why its config could not be read.
  pub error: Option<String>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentResult {
  pub id: String,
  pub success: bool,
  pub path: String,
  /// The file was written; false when it already was as asked.
  pub changed: bool,
  pub error: Option<String>,
}

pub fn find(id: &str) -> Option<&'static Agent> {
  AGENTS.iter().find(|agent| agent.id == id)
}

fn read(path: &Path) -> Result<Option<String>, String> {
  match fs::read_to_string(path) {
    Ok(text) => Ok(Some(text)),
    Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
    Err(error) => {
      log::warn!("MCP: could not read {}: {error}", path.display());
      Err("Ayar dosyası okunamadı.".into())
    }
  }
}

fn parse_value(format: Format, text: &str) -> Result<Value, String> {
  match format {
    Format::Json => json::parse_value(text),
    Format::Toml => toml::parse_value(text),
    Format::Yaml => yaml::parse_value(text),
  }
}

fn value_at<'a>(document: &'a Value, path: &[&str]) -> Option<&'a Value> {
  path.iter().try_fold(document, |value, key| value.get(key))
}

/// Whether OpenCode would read `value` as a server (src/opencode-config.ts).
fn is_opencode_server(value: &Value) -> bool {
  let Some(entry) = value.as_object() else {
    return false;
  };
  let text = |key: &str| {
    entry
      .get(key)
      .and_then(Value::as_str)
      .filter(|text| !text.is_empty())
  };
  let command = entry.get("command");
  matches!(text("type"), Some("local" | "remote"))
    || text("url").is_some()
    || text("command").is_some()
    || command
      .and_then(Value::as_array)
      .is_some_and(|parts| parts.iter().any(Value::is_string))
    || ((entry.get("enabled").is_some_and(Value::is_boolean)
      || entry.get("disabled").is_some_and(Value::is_boolean))
      && entry.get("type").is_none()
      && entry.get("url").is_none()
      && command.is_none())
}

const OPENCODE_NATIVE: &[&str] = &["mcp", "servers"];

/// OpenCode V2 keeps servers in `mcp.servers`, V1 right in `mcp`. Writes go
/// where the server is, else to V2 when the file uses only V2, else to V1.
fn opencode_servers(document: &Value) -> &'static [&'static str] {
  let mcp = document.get("mcp").and_then(Value::as_object);
  let native = mcp
    .and_then(|mcp| mcp.get("servers"))
    .filter(|servers| servers.is_object() && !is_opencode_server(servers));
  if native.is_some_and(|servers| servers.get(SERVER_KEY).is_some()) {
    return OPENCODE_NATIVE;
  }
  let legacy = |name: &str| {
    mcp
      .and_then(|mcp| mcp.get(name))
      .is_some_and(is_opencode_server)
  };
  if legacy(SERVER_KEY) {
    return &["mcp"];
  }
  let has_legacy = mcp.is_some_and(|mcp| {
    mcp
      .keys()
      .any(|name| !(native.is_some() && name == "servers") && legacy(name))
  });
  if native.is_some() && !has_legacy {
    OPENCODE_NATIVE
  } else {
    &["mcp"]
  }
}

fn has_server(agent: &Agent, path: &Path) -> Result<bool, String> {
  let Some(text) = read(path)? else {
    return Ok(false);
  };
  let document = parse_value(agent.format, &text)?;
  let found = |path: &[&str]| {
    value_at(&document, path)
      .and_then(|servers| servers.get(SERVER_KEY))
      .is_some()
  };
  Ok(if agent.id == "opencode" {
    found(OPENCODE_NATIVE) || found(&["mcp"])
  } else {
    found(agent.servers)
  })
}

/// Every agent, with whether it is installed and already has Angaria.
pub fn detect_agents(env: &Env) -> Vec<AgentStatus> {
  AGENTS
    .iter()
    .map(|agent| {
      let path = (agent.config)(env);
      let (ours, error) = match has_server(agent, &path) {
        Ok(ours) => (ours, None),
        Err(error) => (false, Some(error)),
      };
      AgentStatus {
        id: agent.id,
        name: agent.name,
        installed: (agent.detect)(env),
        config_path: path.display().to_string(),
        our_server_installed: ours,
        error,
      }
    })
    .collect()
}

/// The copy of the file from before Angaria's last change to it.
pub fn backup_path(path: &Path) -> PathBuf {
  let mut name = path.file_name().unwrap_or_default().to_os_string();
  name.push(".angaria.bak");
  path.with_file_name(name)
}

#[cfg(unix)]
fn set_mode(path: &Path, mode: u32) -> std::io::Result<()> {
  use std::os::unix::fs::PermissionsExt;
  fs::set_permissions(path, fs::Permissions::from_mode(mode))
}

/// Writes `text` to `path` in one rename, after copying `previous` to the
/// backup. A symlinked config stays a link: the file it points to changes.
fn write(path: &Path, text: &str, previous: Option<&str>, private: bool) -> std::io::Result<()> {
  let target = match fs::symlink_metadata(path) {
    Ok(metadata) if metadata.file_type().is_symlink() => fs::canonicalize(path)?,
    _ => path.to_path_buf(),
  };
  let dir = target.parent().ok_or(ErrorKind::NotFound)?;
  fs::create_dir_all(dir)?;
  let permissions = fs::metadata(&target)
    .ok()
    .map(|metadata| metadata.permissions());
  // The backup and the temp file are created with the config's own mode (0600
  // for a private one), never the umask's 0644: a token in ~/.claude.json must
  // not sit in a world-readable copy, even for a moment.
  let new_file = || {
    let mut options = OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
      use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
      let mode = match &permissions {
        Some(permissions) => permissions.mode() & 0o777,
        None if private => 0o600,
        None => 0o644,
      };
      options.mode(if private { 0o600 } else { mode });
    }
    options
  };
  if let Some(previous) = previous {
    let backup = backup_path(&target);
    let mut file = new_file().open(&backup)?;
    if let Some(permissions) = &permissions {
      fs::set_permissions(&backup, permissions.clone())?;
    }
    file.write_all(previous.as_bytes())?;
  }
  let mut name = target.file_name().unwrap_or_default().to_os_string();
  name.push(".angaria-tmp");
  let temp = dir.join(name);
  let options = new_file();
  let written = (|| {
    let mut file = options.open(&temp)?;
    file.write_all(text.as_bytes())?;
    file.sync_all()?;
    if let Some(permissions) = &permissions {
      fs::set_permissions(&temp, permissions.clone())?;
    }
    fs::rename(&temp, &target)
  })();
  if written.is_err() {
    let _ = fs::remove_file(&temp);
  }
  written?;
  #[cfg(unix)]
  if private {
    set_mode(dir, 0o700)?;
    set_mode(&target, 0o600)?;
  }
  Ok(())
}

fn save(path: &Path, text: &str, previous: Option<&str>, private: bool) -> Result<(), String> {
  write(path, text, previous, private).map_err(|error| {
    log::warn!("MCP: could not write {}: {error}", path.display());
    "Ayar dosyası yazılamadı.".to_string()
  })
}

fn result(id: &str, path: &Path, outcome: Result<bool, String>) -> AgentResult {
  let (success, changed, error) = match outcome {
    Ok(changed) => (true, changed, None),
    Err(error) => (false, false, Some(error)),
  };
  AgentResult {
    id: id.into(),
    success,
    path: path.display().to_string(),
    changed,
    error,
  }
}

/// A result for an id that is not in the table.
pub fn unknown(id: &str) -> AgentResult {
  AgentResult {
    id: id.into(),
    success: false,
    path: String::new(),
    changed: false,
    error: Some("Bilinmeyen uygulama.".into()),
  }
}

fn upsert_at(agent: &Agent, path: &Path, bridge: &str) -> Result<bool, String> {
  let previous = read(path)?;
  let text = previous.as_deref().unwrap_or("");
  let mut entry = (agent.entry)(bridge);
  let edited = match agent.format {
    Format::Json => {
      let servers = if agent.id == "opencode" {
        let servers = opencode_servers(&json::parse_value(text)?);
        if servers == OPENCODE_NATIVE {
          entry.as_object_mut().map(|entry| entry.remove("enabled"));
        }
        servers
      } else {
        agent.servers
      };
      json::upsert(text, servers, SERVER_KEY, &entry, agent.strict)?
    }
    Format::Toml => toml::upsert(text, agent.servers, SERVER_KEY, &entry)?,
    Format::Yaml => yaml::upsert(text, agent.servers[0], SERVER_KEY, &entry)?,
  };
  let Some(edited) = edited else {
    return Ok(false);
  };
  save(path, &edited, previous.as_deref(), agent.private)?;
  Ok(true)
}

/// Adds the bridge at `bridge` to `agent`'s config as "angaria", or makes
/// the entry exactly that; creates the file and its folders when missing.
/// Everything else in the file stays.
pub fn upsert_server(agent: &Agent, env: &Env, bridge: &str) -> AgentResult {
  let path = (agent.config)(env);
  let through_cli = (agent.id == "claude-code")
    .then(|| claude::upsert(env, &path, bridge))
    .flatten();
  let outcome = through_cli.unwrap_or_else(|| upsert_at(agent, &path, bridge));
  result(agent.id, &path, outcome)
}

fn remove_at(agent: &Agent, path: &Path) -> Result<bool, String> {
  let Some(previous) = read(path)? else {
    return Ok(false);
  };
  let edited = match agent.format {
    Format::Json if agent.id == "opencode" => {
      // V1 and V2 can both hold it; the V1 copy would come back otherwise.
      let native = json::remove(&previous, OPENCODE_NATIVE, SERVER_KEY, false)?;
      let text = native.as_deref().unwrap_or(&previous);
      json::remove(text, &["mcp"], SERVER_KEY, false)?.or(native)
    }
    Format::Json => json::remove(&previous, agent.servers, SERVER_KEY, agent.strict)?,
    Format::Toml => toml::remove(&previous, agent.servers, SERVER_KEY)?,
    Format::Yaml => yaml::remove(&previous, agent.servers[0], SERVER_KEY)?,
  };
  let Some(edited) = edited else {
    return Ok(false);
  };
  save(path, &edited, Some(&previous), agent.private)?;
  Ok(true)
}

/// Takes "angaria" out of `agent`'s config; nothing else changes.
pub fn remove_server(agent: &Agent, env: &Env) -> AgentResult {
  let path = (agent.config)(env);
  let through_cli = (agent.id == "claude-code")
    .then(|| claude::remove(env, &path))
    .flatten();
  let outcome = through_cli.unwrap_or_else(|| remove_at(agent, &path));
  result(agent.id, &path, outcome)
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;

  const BRIDGE: &str = "/Applications/Angaria.app/Contents/MacOS/angaria-mcp";

  fn temp_home(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("angaria-agents-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
  }

  fn agent(id: &str) -> &'static Agent {
    find(id).unwrap()
  }

  fn status<'a>(statuses: &'a [AgentStatus], id: &str) -> &'a AgentStatus {
    statuses.iter().find(|status| status.id == id).unwrap()
  }

  #[test]
  fn the_table_has_unique_ids_and_valid_entries() {
    assert_eq!(AGENTS.len(), 22);
    for (index, agent) in AGENTS.iter().enumerate() {
      assert!(AGENTS[index + 1..].iter().all(|other| other.id != agent.id));
      assert!(!agent.servers.is_empty());
      let entry = (agent.entry)(BRIDGE);
      let named = entry.get("command").or_else(|| entry.get("cmd")).unwrap();
      assert!(named == BRIDGE || named == &json!([BRIDGE]), "{}", agent.id);
    }
  }

  #[test]
  fn detection_follows_the_home_folder() {
    let home = temp_home("detect");
    let env = Env::new(home.clone());
    assert!(detect_agents(&env).iter().all(|status| !status.installed));

    fs::create_dir_all(home.join(".cursor")).unwrap();
    fs::create_dir_all(home.join(".codex")).unwrap();
    fs::create_dir_all(home.join(".config/zed")).unwrap();
    fs::write(
      home.join(".cursor/mcp.json"),
      r#"{"mcpServers":{"angaria":{"command":"/old"}}}"#,
    )
    .unwrap();
    fs::write(home.join(".codex/config.toml"), "model = ").unwrap();
    let statuses = detect_agents(&env);
    let cursor = status(&statuses, "cursor");
    assert!(cursor.installed && cursor.our_server_installed);
    assert_eq!(
      cursor.config_path,
      home.join(".cursor/mcp.json").display().to_string()
    );
    let codex = status(&statuses, "codex");
    assert!(codex.installed && !codex.our_server_installed);
    assert!(codex.error.is_some());
    assert!(status(&statuses, "zed").installed);
    assert!(!status(&statuses, "claude-code").installed);

    let custom = home.join("elsewhere");
    let env = Env::new(home.clone()).with_var("CODEX_HOME", &custom);
    assert_eq!(
      status(&detect_agents(&env), "codex").config_path,
      custom.join("config.toml").display().to_string()
    );
    fs::remove_dir_all(home).unwrap();
  }

  #[test]
  fn upsert_creates_then_leaves_the_file_alone() {
    let home = temp_home("upsert");
    let env = Env::new(home.clone());
    let created = upsert_server(agent("claude-desktop"), &env, BRIDGE);
    assert!(created.success && created.changed, "{created:?}");
    let path = PathBuf::from(&created.path);
    let written = fs::read_to_string(&path).unwrap();
    let value: Value = serde_json::from_str(&written).unwrap();
    assert_eq!(
      value["mcpServers"]["angaria"],
      json!({ "command": BRIDGE, "args": [] })
    );
    assert!(!backup_path(&path).exists());

    let again = upsert_server(agent("claude-desktop"), &env, BRIDGE);
    assert!(again.success && !again.changed);
    assert_eq!(fs::read_to_string(&path).unwrap(), written);

    let moved = upsert_server(agent("claude-desktop"), &env, "/elsewhere/angaria-mcp");
    assert!(moved.changed);
    assert_eq!(fs::read_to_string(backup_path(&path)).unwrap(), written);
    fs::remove_dir_all(home).unwrap();
  }

  #[test]
  fn every_agent_round_trips() {
    let home = temp_home("round-trip");
    let env = Env::new(home.clone());
    for agent in &AGENTS {
      let added = upsert_server(agent, &env, BRIDGE);
      assert!(added.success && added.changed, "{added:?}");
      assert!(!upsert_server(agent, &env, BRIDGE).changed, "{}", agent.id);
      assert!(
        has_server(agent, Path::new(&added.path)).unwrap(),
        "{}",
        agent.id
      );
      let removed = remove_server(agent, &env);
      assert!(removed.success && removed.changed, "{removed:?}");
      assert!(
        !has_server(agent, Path::new(&added.path)).unwrap(),
        "{}",
        agent.id
      );
      assert!(!remove_server(agent, &env).changed, "{}", agent.id);
    }
    fs::remove_dir_all(home).unwrap();
  }

  fn home_env(home: &Path) -> Env {
    Env::new(home.to_path_buf())
  }

  #[test]
  fn foreign_entries_and_comments_stay() {
    let home = temp_home("foreign");
    let env = home_env(&home);
    let path = home.join(".config/zed/settings.json");
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    let original = "// Zed settings\n{\n  \"theme\": \"One Dark\",\n  \"context_servers\": {\n    \"other\": { \"command\": \"x\" }\n  }\n}\n";
    fs::write(&path, original).unwrap();
    assert!(upsert_server(agent("zed"), &env, BRIDGE).changed);
    let written = fs::read_to_string(&path).unwrap();
    assert!(written.starts_with("// Zed settings\n"));
    assert_eq!(fs::read_to_string(backup_path(&path)).unwrap(), original);
    assert!(remove_server(agent("zed"), &env).changed);
    let value = json::parse_value(&fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(
      value["context_servers"],
      json!({ "other": { "command": "x" } })
    );
    assert_eq!(value["theme"], "One Dark");
    fs::remove_dir_all(home).unwrap();
  }

  #[test]
  fn a_malformed_file_is_never_written() {
    let home = temp_home("malformed");
    let env = home_env(&home);
    let path = home.join(".cursor/mcp.json");
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(&path, "{ \"mcpServers\": ").unwrap();
    let failed = upsert_server(agent("cursor"), &env, BRIDGE);
    assert!(!failed.success && !failed.changed);
    assert!(failed.error.unwrap().contains("dokunmadı"));
    assert!(!remove_server(agent("cursor"), &env).success);
    assert_eq!(fs::read_to_string(&path).unwrap(), "{ \"mcpServers\": ");
    assert!(!backup_path(&path).exists());
    // One failing agent leaves the others alone.
    assert!(upsert_server(agent("windsurf"), &env, BRIDGE).success);
    fs::remove_dir_all(home).unwrap();
  }

  #[test]
  fn opencode_writes_where_the_file_keeps_its_servers() {
    let legacy = json!({ "mcp": { "other": { "type": "local", "command": ["x"] } } });
    assert_eq!(opencode_servers(&legacy), ["mcp"]);
    let native =
      json!({ "mcp": { "servers": { "other": { "type": "local", "command": ["x"] } } } });
    assert_eq!(opencode_servers(&native), OPENCODE_NATIVE);
    let mixed = json!({ "mcp": { "servers": {}, "other": { "url": "https://x" } } });
    assert_eq!(opencode_servers(&mixed), ["mcp"]);
    assert_eq!(opencode_servers(&json!({})), ["mcp"]);

    let home = temp_home("opencode");
    let env = home_env(&home);
    let path = home.join(".config/opencode/opencode.json");
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(&path, native.to_string()).unwrap();
    assert!(upsert_server(agent("opencode"), &env, BRIDGE).changed);
    let value = json::parse_value(&fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(
      value["mcp"]["servers"]["angaria"],
      json!({ "type": "local", "command": [BRIDGE], "environment": {} })
    );
    assert!(remove_server(agent("opencode"), &env).changed);
    assert!(!has_server(agent("opencode"), &path).unwrap());
    fs::remove_dir_all(home).unwrap();
  }

  #[cfg(unix)]
  #[test]
  fn symlinks_stay_and_private_files_stay_private() {
    use std::os::unix::fs::PermissionsExt;
    let home = temp_home("links");
    let env = home_env(&home);
    let real = home.join("dotfiles/mcp.json");
    fs::create_dir_all(real.parent().unwrap()).unwrap();
    fs::write(&real, "{}").unwrap();
    fs::create_dir_all(home.join(".cursor")).unwrap();
    std::os::unix::fs::symlink(&real, home.join(".cursor/mcp.json")).unwrap();
    assert!(upsert_server(agent("cursor"), &env, BRIDGE).changed);
    assert!(fs::symlink_metadata(home.join(".cursor/mcp.json"))
      .unwrap()
      .file_type()
      .is_symlink());
    assert!(fs::read_to_string(&real).unwrap().contains(BRIDGE));

    let fx = upsert_server(agent("fx"), &env, BRIDGE);
    let mode = |path: &Path| fs::metadata(path).unwrap().permissions().mode() & 0o777;
    assert_eq!(mode(Path::new(&fx.path)), 0o600);
    assert_eq!(mode(&home.join(".fx")), 0o700);
    fs::remove_dir_all(home).unwrap();
  }

  #[cfg(unix)]
  #[test]
  fn the_backup_keeps_a_private_config_private() {
    use std::os::unix::fs::PermissionsExt;
    let home = temp_home("backup-mode");
    let env = home_env(&home);
    let path = home.join(".cursor/mcp.json");
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(&path, "{ \"mcpServers\": {} }").unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
    assert!(upsert_server(agent("cursor"), &env, BRIDGE).changed);
    let mode = |path: &Path| fs::metadata(path).unwrap().permissions().mode() & 0o777;
    assert_eq!(mode(&backup_path(&path)), 0o600);
    assert_eq!(mode(&path), 0o600);
    fs::remove_dir_all(home).unwrap();
  }
}
