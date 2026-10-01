use keyring::{Entry, Error};

const SERVICE: &str = "com.vinena.angaria";

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

#[tauri::command]
pub async fn secret_set(key: String, value: String) -> Result<(), String> {
  entry(&key)?.set_password(&value).map_err(describe)
}

#[tauri::command]
pub async fn secret_get(key: String) -> Result<Option<String>, String> {
  match entry(&key)?.get_password() {
    Ok(value) => Ok(Some(value)),
    Err(Error::NoEntry) => Ok(None),
    Err(e) => Err(describe(e)),
  }
}

#[tauri::command]
pub async fn secret_delete(key: String) -> Result<(), String> {
  match entry(&key)?.delete_credential() {
    Ok(()) | Err(Error::NoEntry) => Ok(()),
    Err(e) => Err(describe(e)),
  }
}
