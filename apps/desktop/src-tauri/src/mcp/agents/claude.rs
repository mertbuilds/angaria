//! Claude Code rewrites `~/.claude.json` while it runs, so an edit Angaria
//! makes there can be lost to its next write. When the `claude` CLI is on
//! this Mac, Angaria asks it to add or remove the server instead, and edits
//! the file only when the CLI is missing or fails.

use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use serde_json::Value;

use super::{json, read, Env, SERVER_KEY};

/// Where the installers put the CLI, under the home folder.
const HOME_PATHS: [&str; 2] = [".claude/local/claude", ".local/bin/claude"];
/// Homebrew and npm's global folders. A GUI app's PATH holds neither.
const SYSTEM_DIRS: [&str; 2] = ["/opt/homebrew/bin", "/usr/local/bin"];
const LOOKUP_TIMEOUT: Duration = Duration::from_secs(3);
const RUN_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Debug, PartialEq)]
pub enum Plan {
  /// The config is already as asked.
  Nothing,
  /// Through the CLI; `replace` removes an old entry first (`mcp add` refuses a taken name).
  Cli { replace: bool },
  /// Edit the file.
  File,
}

/// Whether `entry` already runs `bridge` with no arguments.
fn runs(entry: &Value, bridge: &str) -> bool {
  entry.get("command").and_then(Value::as_str) == Some(bridge)
    && entry.get("url").is_none()
    && entry
      .get("args")
      .map_or(true, |args| args.as_array().is_some_and(Vec::is_empty))
}

/// How to make `current` (the "angaria" entry, if any) run `bridge`.
pub fn plan_add(current: Option<&Value>, bridge: &str, cli: bool) -> Plan {
  match current {
    Some(entry) if runs(entry, bridge) => Plan::Nothing,
    _ if cli => Plan::Cli {
      replace: current.is_some(),
    },
    _ => Plan::File,
  }
}

/// How to take `current` out.
pub fn plan_remove(current: Option<&Value>, cli: bool) -> Plan {
  match current {
    None => Plan::Nothing,
    Some(_) if cli => Plan::Cli { replace: false },
    Some(_) => Plan::File,
  }
}

#[cfg(unix)]
fn is_executable(path: &Path) -> bool {
  use std::os::unix::fs::PermissionsExt;
  path
    .metadata()
    .is_ok_and(|metadata| metadata.is_file() && metadata.permissions().mode() & 0o111 != 0)
}

#[cfg(not(unix))]
fn is_executable(path: &Path) -> bool {
  path.is_file()
}

/// The CLI: the usual install paths first, then `lookup` (the login shell).
fn find_with(env: &Env, lookup: impl FnOnce() -> Option<PathBuf>) -> Option<PathBuf> {
  let mut candidates: Vec<PathBuf> = HOME_PATHS
    .iter()
    .map(|path| env.home_dir().join(path))
    .collect();
  if env.system() {
    candidates.extend(SYSTEM_DIRS.iter().map(|dir| Path::new(dir).join("claude")));
  }
  candidates
    .into_iter()
    .find(|path| is_executable(path))
    .or_else(|| lookup().filter(|path| is_executable(path)))
}

pub fn find(env: &Env) -> Option<PathBuf> {
  find_with(env, || env.system().then(login_shell_lookup).flatten())
}

struct Ran {
  success: bool,
  stdout: String,
  stderr: String,
}

/// Runs `command`, killing it after `timeout`.
fn run(command: &mut Command, timeout: Duration) -> io::Result<Ran> {
  let mut child = command
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()?;
  let started = Instant::now();
  let status = loop {
    if let Some(status) = child.try_wait()? {
      break status;
    }
    if started.elapsed() > timeout {
      let _ = child.kill();
      let _ = child.wait();
      return Err(io::Error::new(io::ErrorKind::TimedOut, "timed out"));
    }
    thread::sleep(Duration::from_millis(50));
  };
  let mut stdout = String::new();
  let mut stderr = String::new();
  if let Some(mut out) = child.stdout.take() {
    out.read_to_string(&mut stdout)?;
  }
  if let Some(mut err) = child.stderr.take() {
    err.read_to_string(&mut stderr)?;
  }
  Ok(Ran {
    success: status.success(),
    stdout,
    stderr,
  })
}

/// `command -v claude` in the user's login shell, which sees their PATH.
fn login_shell_lookup() -> Option<PathBuf> {
  let shell = std::env::var_os("SHELL")
    .filter(|shell| !shell.is_empty())
    .unwrap_or_else(|| "/bin/zsh".into());
  let ran = run(
    Command::new(shell).args(["-lc", "command -v claude"]),
    LOOKUP_TIMEOUT,
  )
  .ok()?;
  if !ran.success {
    return None;
  }
  ran
    .stdout
    .lines()
    .rev()
    .map(str::trim)
    .find(|line| line.starts_with('/'))
    .map(PathBuf::from)
}

/// Runs the CLI with its own folder and the system folders on PATH, so a
/// script CLI finds node.
fn claude(cli: &Path, env: &Env, args: &[&str]) -> Result<(), String> {
  let mut dirs: Vec<PathBuf> = cli.parent().map(Path::to_path_buf).into_iter().collect();
  dirs.extend(SYSTEM_DIRS.iter().map(PathBuf::from));
  if let Some(path) = std::env::var_os("PATH") {
    dirs.extend(std::env::split_paths(&path));
  }
  let path = std::env::join_paths(dirs).map_err(|error| error.to_string())?;
  let ran = run(
    Command::new(cli)
      .args(args)
      .env("PATH", path)
      .current_dir(env.home_dir()),
    RUN_TIMEOUT,
  )
  .map_err(|error| error.to_string())?;
  if ran.success {
    Ok(())
  } else {
    Err(format!("{}{}", ran.stdout, ran.stderr).trim().to_string())
  }
}

/// The "angaria" entry in `~/.claude.json`.
fn current(path: &Path) -> Result<Option<Value>, String> {
  let Some(text) = read(path)? else {
    return Ok(None);
  };
  Ok(
    json::parse_value(&text)?
      .get("mcpServers")
      .and_then(|servers| servers.get(SERVER_KEY))
      .cloned(),
  )
}

/// Adds the bridge through the CLI. `None`: edit the file instead.
pub fn upsert(env: &Env, path: &Path, bridge: &str) -> Option<Result<bool, String>> {
  let current = match current(path) {
    Ok(current) => current,
    Err(error) => return Some(Err(error)),
  };
  if plan_add(current.as_ref(), bridge, false) == Plan::Nothing {
    return Some(Ok(false));
  }
  let cli = find(env)?;
  let Plan::Cli { replace } = plan_add(current.as_ref(), bridge, true) else {
    return None;
  };
  if replace {
    let _ = claude(&cli, env, &["mcp", "remove", "--scope", "user", SERVER_KEY]);
  }
  let add = ["mcp", "add", "--scope", "user", SERVER_KEY, "--", bridge];
  match claude(&cli, env, &add) {
    Ok(()) => Some(Ok(true)),
    Err(error) => {
      log::warn!("MCP: claude mcp add failed, editing the file: {error}");
      None
    }
  }
}

/// Removes the server through the CLI. `None`: edit the file instead.
pub fn remove(env: &Env, path: &Path) -> Option<Result<bool, String>> {
  let current = match current(path) {
    Ok(current) => current,
    Err(error) => return Some(Err(error)),
  };
  if plan_remove(current.as_ref(), false) == Plan::Nothing {
    return Some(Ok(false));
  }
  let cli = find(env)?;
  match claude(&cli, env, &["mcp", "remove", "--scope", "user", SERVER_KEY]) {
    Ok(()) => Some(Ok(true)),
    Err(error) => {
      log::warn!("MCP: claude mcp remove failed, editing the file: {error}");
      None
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;
  use std::fs;

  const BRIDGE: &str = "/Applications/Angaria.app/Contents/MacOS/angaria-mcp";

  #[test]
  fn plans_follow_the_entry_and_the_cli() {
    let ours = json!({ "type": "stdio", "command": BRIDGE, "args": [], "env": {} });
    let old = json!({ "command": "/old/angaria-mcp", "args": [] });
    assert_eq!(plan_add(Some(&ours), BRIDGE, true), Plan::Nothing);
    assert_eq!(
      plan_add(Some(&json!({ "command": BRIDGE })), BRIDGE, false),
      Plan::Nothing
    );
    assert_eq!(
      plan_add(Some(&old), BRIDGE, true),
      Plan::Cli { replace: true }
    );
    assert_eq!(plan_add(None, BRIDGE, true), Plan::Cli { replace: false });
    assert_eq!(plan_add(Some(&old), BRIDGE, false), Plan::File);
    assert_eq!(plan_add(None, BRIDGE, false), Plan::File);
    let with_args = json!({ "command": BRIDGE, "args": ["-x"] });
    assert_eq!(plan_add(Some(&with_args), BRIDGE, false), Plan::File);
    assert_eq!(plan_remove(None, true), Plan::Nothing);
    assert_eq!(plan_remove(Some(&ours), true), Plan::Cli { replace: false });
    assert_eq!(plan_remove(Some(&ours), false), Plan::File);
  }

  fn temp_home(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("angaria-claude-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
  }

  #[cfg(unix)]
  fn fake_cli(home: &Path, relative: &str, exit: i32) -> PathBuf {
    use std::os::unix::fs::PermissionsExt;
    let path = home.join(relative);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    let log = home.join("calls.log");
    let script = format!(
      "#!/bin/sh\necho \"$@\" >> '{}'\nexit {exit}\n",
      log.display()
    );
    fs::write(&path, script).unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
    path
  }

  #[cfg(unix)]
  #[test]
  fn the_cli_is_found_under_home_and_through_the_lookup() {
    let home = temp_home("find");
    let env = Env::new(home.clone());
    assert_eq!(find_with(&env, || None), None);
    let elsewhere = fake_cli(&home, "bin/claude", 0);
    assert_eq!(
      find_with(&env, || Some(elsewhere.clone())),
      Some(elsewhere.clone())
    );
    assert_eq!(find_with(&env, || Some(home.join("nope"))), None);
    let local = fake_cli(&home, ".local/bin/claude", 0);
    assert_eq!(find_with(&env, || Some(elsewhere.clone())), Some(local));
    let native = fake_cli(&home, ".claude/local/claude", 0);
    assert_eq!(find(&env), Some(native));
    fs::remove_dir_all(home).unwrap();
  }

  #[cfg(unix)]
  #[test]
  fn adds_and_removes_through_the_cli() {
    let home = temp_home("cli");
    let env = Env::new(home.clone());
    let path = home.join(".claude.json");
    fake_cli(&home, ".local/bin/claude", 0);
    assert_eq!(upsert(&env, &path, BRIDGE), Some(Ok(true)));
    fs::write(&path, r#"{"mcpServers":{"angaria":{"command":"/old"}}}"#).unwrap();
    assert_eq!(upsert(&env, &path, BRIDGE), Some(Ok(true)));
    assert_eq!(remove(&env, &path), Some(Ok(true)));
    fs::write(
      &path,
      format!(r#"{{"mcpServers":{{"angaria":{{"command":"{BRIDGE}"}}}}}}"#),
    )
    .unwrap();
    assert_eq!(upsert(&env, &path, BRIDGE), Some(Ok(false)));
    let calls = fs::read_to_string(home.join("calls.log")).unwrap();
    assert_eq!(
      calls,
      format!(
        "mcp add --scope user angaria -- {BRIDGE}\n\
         mcp remove --scope user angaria\n\
         mcp add --scope user angaria -- {BRIDGE}\n\
         mcp remove --scope user angaria\n"
      )
    );
    fs::remove_dir_all(home).unwrap();
  }

  #[cfg(unix)]
  #[test]
  fn falls_back_to_the_file_without_a_working_cli() {
    let home = temp_home("fallback");
    let env = Env::new(home.clone());
    let path = home.join(".claude.json");
    assert_eq!(upsert(&env, &path, BRIDGE), None);
    fake_cli(&home, ".local/bin/claude", 1);
    assert_eq!(upsert(&env, &path, BRIDGE), None);
    fs::write(&path, "{ broken").unwrap();
    assert!(matches!(upsert(&env, &path, BRIDGE), Some(Err(_))));
    fs::remove_dir_all(home).unwrap();
  }
}
