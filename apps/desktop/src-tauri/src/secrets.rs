use keyring::{Entry, Error};

const SERVICE: &str = "com.vinena.angaria";

fn entry(key: &str) -> Result<Entry, String> {
  Entry::new(SERVICE, key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn secret_set(key: String, value: String) -> Result<(), String> {
  entry(&key)?.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn secret_get(key: String) -> Result<Option<String>, String> {
  match entry(&key)?.get_password() {
    Ok(value) => Ok(Some(value)),
    Err(Error::NoEntry) => Ok(None),
    Err(e) => Err(e.to_string()),
  }
}

#[tauri::command]
pub async fn secret_delete(key: String) -> Result<(), String> {
  match entry(&key)?.delete_credential() {
    Ok(()) | Err(Error::NoEntry) => Ok(()),
    Err(e) => Err(e.to_string()),
  }
}
