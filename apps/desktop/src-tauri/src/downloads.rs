//! Downloads: the app writes every file it makes (the Angaria PDF, the
//! e-Arşiv PDF, GİB's zip) into the user's Downloads folder itself, so the
//! webview learns where the file went and can show it in Finder or open it
//! (`@tauri-apps/plugin-opener`). A name already taken gets a number, as
//! browsers do, and nothing is overwritten: "name.pdf", "name (2).pdf".

use std::fs::{self, OpenOptions};
use std::io::{self, ErrorKind, Write};
use std::path::{Path, PathBuf};

use base64::Engine;
use tauri::ipc::{InvokeBody, Request};
use tauri::Manager;

/// The file name as base64 of its UTF-8: header values are ASCII.
const NAME_HEADER: &str = "x-file-name";
/// The last numbered name tried: "name (999).pdf".
const MAX_COPY: u32 = 999;

/// Saves the request's bytes in Downloads under the name its header carries
/// and answers the file's path.
#[tauri::command]
pub async fn save_download(app: tauri::AppHandle, request: Request<'_>) -> Result<String, String> {
  let InvokeBody::Raw(bytes) = request.body() else {
    return Err("expected the file's bytes".into());
  };
  let name = request
    .headers()
    .get(NAME_HEADER)
    .and_then(|value| value.to_str().ok())
    .and_then(|value| base64::engine::general_purpose::STANDARD.decode(value).ok())
    .and_then(|name| String::from_utf8(name).ok())
    .ok_or("missing file name")?;
  let dir = app.path().download_dir().map_err(|error| error.to_string())?;
  let path = save_new(&dir, &name, bytes).map_err(|error| error.to_string())?;
  Ok(path.to_string_lossy().into_owned())
}

/// Writes `bytes` to a new file in `dir`: `name`, or the first free numbered
/// name after it. The file is created only if it does not exist, so a file
/// another program writes meanwhile is never replaced.
pub fn save_new(dir: &Path, name: &str, bytes: &[u8]) -> io::Result<PathBuf> {
  if !is_plain_name(name) {
    return Err(io::Error::new(
      ErrorKind::InvalidInput,
      format!("not a plain file name: {name:?}"),
    ));
  }
  for copy in 1..=MAX_COPY {
    let path = dir.join(numbered(name, copy));
    match OpenOptions::new().write(true).create_new(true).open(&path) {
      Ok(mut file) => {
        if let Err(error) = file.write_all(bytes) {
          let _ = fs::remove_file(&path);
          return Err(error);
        }
        return Ok(path);
      }
      Err(error) if error.kind() == ErrorKind::AlreadyExists => {}
      Err(error) => return Err(error),
    }
  }
  Err(io::Error::new(
    ErrorKind::AlreadyExists,
    format!("{name} and its numbered copies up to {MAX_COPY} exist"),
  ))
}

/// The name of the `copy`th file: "name.pdf" for the first, "name (2).pdf"
/// for the second. A name without an extension takes the number at its end.
pub fn numbered(name: &str, copy: u32) -> String {
  if copy <= 1 {
    return name.to_string();
  }
  match name.rfind('.') {
    Some(dot) if dot > 0 => format!("{} ({copy}){}", &name[..dot], &name[dot..]),
    _ => format!("{name} ({copy})"),
  }
}

/// A file name alone: no folder in it, not hidden, not `.` or `..`.
fn is_plain_name(name: &str) -> bool {
  !name.is_empty() && !name.starts_with('.') && !name.contains(['/', '\\', '\0'])
}

#[cfg(test)]
mod tests {
  use super::*;

  fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("angaria-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
  }

  #[test]
  fn numbers_copies_before_the_extension() {
    assert_eq!(numbered("Fatura-2026-10-03.pdf", 1), "Fatura-2026-10-03.pdf");
    assert_eq!(numbered("Fatura-2026-10-03.pdf", 2), "Fatura-2026-10-03 (2).pdf");
    assert_eq!(numbered("e-Arsiv-Fatura.zip", 12), "e-Arsiv-Fatura (12).zip");
    assert_eq!(numbered("Fatura v1.2.pdf", 2), "Fatura v1.2 (2).pdf");
    assert_eq!(numbered("README", 3), "README (3)");
  }

  #[test]
  fn saves_under_the_name_then_numbers_the_next_ones() {
    let dir = temp_dir("downloads-numbered");
    let first = save_new(&dir, "Fatura-Ana-Varlık.pdf", b"one").unwrap();
    let second = save_new(&dir, "Fatura-Ana-Varlık.pdf", b"two").unwrap();
    let third = save_new(&dir, "Fatura-Ana-Varlık.pdf", b"three").unwrap();

    assert_eq!(first, dir.join("Fatura-Ana-Varlık.pdf"));
    assert_eq!(second, dir.join("Fatura-Ana-Varlık (2).pdf"));
    assert_eq!(third, dir.join("Fatura-Ana-Varlık (3).pdf"));
    assert_eq!(fs::read(&first).unwrap(), b"one");
    assert_eq!(fs::read(&second).unwrap(), b"two");
    assert_eq!(fs::read(&third).unwrap(), b"three");
    fs::remove_dir_all(dir).unwrap();
  }

  #[test]
  fn never_overwrites_and_fills_the_first_free_number() {
    let dir = temp_dir("downloads-free");
    fs::write(dir.join("a.pdf"), b"theirs").unwrap();
    fs::write(dir.join("a (3).pdf"), b"theirs too").unwrap();

    assert_eq!(save_new(&dir, "a.pdf", b"x").unwrap(), dir.join("a (2).pdf"));
    assert_eq!(save_new(&dir, "a.pdf", b"y").unwrap(), dir.join("a (4).pdf"));
    assert_eq!(fs::read(dir.join("a.pdf")).unwrap(), b"theirs");
    assert_eq!(fs::read(dir.join("a (3).pdf")).unwrap(), b"theirs too");
    fs::remove_dir_all(dir).unwrap();
  }

  #[test]
  fn refuses_names_that_leave_the_folder_or_hide() {
    let dir = temp_dir("downloads-refused");
    for name in ["", ".", "..", "../a.pdf", "a/b.pdf", "a\\b.pdf", ".hidden.pdf", "a\0.pdf"] {
      let error = save_new(&dir, name, b"x").unwrap_err();
      assert_eq!(error.kind(), ErrorKind::InvalidInput, "{name:?}");
    }
    assert_eq!(fs::read_dir(&dir).unwrap().count(), 0);
    fs::remove_dir_all(dir).unwrap();
  }
}
