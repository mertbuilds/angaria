use std::fs::{self, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};

use keyring::{Entry, Error};
use tauri::State;

/// Debug builds use their own service, so a dev build that opts into the
/// keychain never touches the release app's item.
const SERVICE: &str = if cfg!(debug_assertions) {
  "com.vinena.angaria.dev"
} else {
  "com.vinena.angaria"
};
/// The one keychain item that holds every secret as JSON (src/lib/vault.ts).
const VAULT_ACCOUNT: &str = "vault";
/// Set to 1 to keep a dev build's vault in the keychain instead of a file.
const DEV_KEYCHAIN_ENV: &str = "ANGARIA_DEV_KEYCHAIN";
const DEV_VAULT_FILE: &str = "dev-vault.json";

/// The keyring error with its kind first, e.g. "PlatformFailure: Platform
/// secure storage failure: User interaction is not allowed."
fn describe(error: Error) -> String {
  let kind = match &error {
    Error::PlatformFailure(_) => "PlatformFailure",
    Error::NoStorageAccess(_) => "NoStorageAccess",
    Error::NoEntry => "NoEntry",
    Error::BadEncoding(_) => "BadEncoding",
    Error::TooLong(..) => "TooLong",
    Error::Invalid(..) => "Invalid",
    Error::Ambiguous(_) => "Ambiguous",
    _ => "Unknown",
  };
  format!("{kind}: {error}")
}

fn entry(key: &str) -> Result<Entry, String> {
  Entry::new(SERVICE, key).map_err(describe)
}

fn keychain_get(key: &str) -> Result<Option<String>, String> {
  match entry(key)?.get_password() {
    Ok(value) => Ok(Some(value)),
    Err(Error::NoEntry) => Ok(None),
    Err(e) => Err(describe(e)),
  }
}

/// Dev builds keep the vault in a file unless ANGARIA_DEV_KEYCHAIN=1: every
/// rebuild of an unsigned binary is a new code identity, and macOS asks for
/// keychain access again. Release builds always use the keychain.
fn uses_file(debug_build: bool, dev_keychain: Option<&str>) -> bool {
  debug_build && dev_keychain != Some("1")
}

/// Where the vault lives.
pub enum VaultStore {
  Keychain,
  /// Dev builds only: a JSON file that only the user can read.
  File(PathBuf),
}

impl VaultStore {
  /// The store for this build. `data_dir` is only asked for in dev builds.
  pub fn for_build(data_dir: impl FnOnce() -> tauri::Result<PathBuf>) -> tauri::Result<Self> {
    let dev_keychain = std::env::var(DEV_KEYCHAIN_ENV).ok();
    let store = if uses_file(cfg!(debug_assertions), dev_keychain.as_deref()) {
      Self::File(data_dir()?.join(DEV_VAULT_FILE))
    } else {
      Self::Keychain
    };
    if cfg!(debug_assertions) {
      match &store {
        Self::Keychain => log::info!("Secrets: keychain item {SERVICE}/{VAULT_ACCOUNT}"),
        Self::File(path) => log::info!(
          "Secrets: dev file {} (set {DEV_KEYCHAIN_ENV}=1 for the keychain)",
          path.display()
        ),
      }
    }
    Ok(store)
  }

  fn read(&self) -> Result<Option<String>, String> {
    match self {
      Self::Keychain => keychain_get(VAULT_ACCOUNT),
      Self::File(path) => read_file(path),
    }
  }

  fn write(&self, json: &str) -> Result<(), String> {
    match self {
      Self::Keychain => entry(VAULT_ACCOUNT)?.set_password(json).map_err(describe),
      Self::File(path) => write_file(path, json),
    }
  }
}

fn file_error(error: std::io::Error) -> String {
  format!("FileStore: {error}")
}

fn read_file(path: &Path) -> Result<Option<String>, String> {
  match fs::read_to_string(path) {
    Ok(json) => Ok(Some(json)),
    Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
    Err(e) => Err(file_error(e)),
  }
}

/// Writes a temporary file with mode 0600, then renames it over the vault, so a
/// crash mid-write never leaves half a vault. The MCP state file uses it too.
pub(crate) fn write_file(path: &Path, json: &str) -> Result<(), String> {
  if let Some(dir) = path.parent() {
    fs::create_dir_all(dir).map_err(file_error)?;
  }
  let temp = path.with_extension("json.tmp");
  let mut options = OpenOptions::new();
  options.write(true).create(true).truncate(true);
  #[cfg(unix)]
  {
    use std::os::unix::fs::OpenOptionsExt;
    options.mode(0o600);
  }
  let mut file = options.open(&temp).map_err(file_error)?;
  // The mode above applies only to a new file.
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    file
      .set_permissions(fs::Permissions::from_mode(0o600))
      .map_err(file_error)?;
  }
  file.write_all(json.as_bytes()).map_err(file_error)?;
  file.sync_all().map_err(file_error)?;
  fs::rename(&temp, path).map_err(file_error)
}

#[tauri::command]
pub async fn vault_read(store: State<'_, VaultStore>) -> Result<Option<String>, String> {
  store.read()
}

#[tauri::command]
pub async fn vault_write(store: State<'_, VaultStore>, json: String) -> Result<(), String> {
  store.write(&json)
}

/// Reads a keychain item from before the vault, once, to move it into the vault.
#[tauri::command]
pub async fn secret_get(key: String) -> Result<Option<String>, String> {
  keychain_get(&key)
}

/// Removes a keychain item from before the vault once the vault holds it.
#[tauri::command]
pub async fn secret_delete(key: String) -> Result<(), String> {
  match entry(&key)?.delete_credential() {
    Ok(()) | Err(Error::NoEntry) => Ok(()),
    Err(e) => Err(describe(e)),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn release_builds_always_use_the_keychain() {
    assert!(!uses_file(false, None));
    assert!(!uses_file(false, Some("0")));
    assert!(!uses_file(false, Some("1")));
  }

  #[test]
  fn dev_builds_use_a_file_unless_opted_into_the_keychain() {
    assert!(uses_file(true, None));
    assert!(uses_file(true, Some("0")));
    assert!(uses_file(true, Some("")));
    assert!(!uses_file(true, Some("1")));
  }

  fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("angaria-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    dir
  }

  #[test]
  fn file_store_reads_nothing_before_the_first_write() {
    let dir = temp_dir("vault-empty");
    let store = VaultStore::File(dir.join(DEV_VAULT_FILE));
    assert_eq!(store.read(), Ok(None));
  }

  #[test]
  fn file_store_round_trips_and_only_the_user_can_read_it() {
    let dir = temp_dir("vault-write");
    let path = dir.join(DEV_VAULT_FILE);
    let store = VaultStore::File(path.clone());

    store.write(r#"{"v":1,"gibPasswords":{}}"#).unwrap();
    store.write(r#"{"v":1,"gibPasswords":{"a":"x"}}"#).unwrap();

    assert_eq!(
      store.read(),
      Ok(Some(r#"{"v":1,"gibPasswords":{"a":"x"}}"#.to_string()))
    );
    assert!(!path.with_extension("json.tmp").exists());
    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      let mode = fs::metadata(&path).unwrap().permissions().mode();
      assert_eq!(mode & 0o777, 0o600);
    }
    fs::remove_dir_all(dir).unwrap();
  }
}
