//! angaria-mcp: the stdio MCP server that MCP clients (Claude Desktop, Cursor,
//! Claude Code) start. It forwards each JSON-RPC line to the MCP server built
//! into the running Angaria app (src/mcp in the app crate) and writes the
//! answer back. The port and the bearer token come from the app's `mcp.json`,
//! so a client's config holds no secret. When Angaria is closed, the bridge
//! opens it in the background (macOS: no window, no Dock icon) and waits for
//! its server (docs/adr/0012-mcp-in-the-background.md).

use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{self, BufRead, Read, Write};
use std::net::{Shutdown, SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use base64::Engine;
use serde_json::{json, Value};

const APP_ID: &str = "com.vinena.angaria";
/// The app writes it (src/mcp/files.rs):
/// `{ "token": "...", "port": 41234, "settings": { "enabled": true, ... } }`.
const STATE_FILE: &str = "mcp.json";
/// Overrides where `mcp.json` is looked for (tests).
const DIR_ENV: &str = "ANGARIA_MCP_DIR";
const META_VERSION: &str = "io.modelcontextprotocol/protocolVersion";
/// How long a freshly opened Angaria gets to start its server.
const LAUNCH_WAIT: Duration = Duration::from_secs(15);
/// The arguments of a background launch (src/background.rs in the app).
const LAUNCH_ARGS: [&str; 2] = ["--background", "--for-mcp"];
const LAUNCH_AGAIN_AFTER: Duration = Duration::from_secs(60);
/// Longer than the server's own wait for a tool (120 seconds).
const READ_TIMEOUT: Duration = Duration::from_secs(150);
const INTERNAL_ERROR: i64 = -32603;

const MCP_OFF: &str = "Angaria’da MCP kapalı. Angaria › MCP’den aç.";
const NOT_REACHABLE: &str =
  "Angaria’ya bağlanılamadı. Angaria’yı aç ve MCP bölümünde MCP sunucusunu aç.";
const CONNECTION_LOST: &str =
  "Angaria’yla bağlantı yanıt gelmeden koptu. İşlemin yapılıp yapılmadığını Angaria’da kontrol et.";

/// Where the app keeps `mcp.json`: Tauri's app data dir for the bundle id.
fn data_dir() -> Option<PathBuf> {
  if let Some(dir) = env::var_os(DIR_ENV) {
    return Some(PathBuf::from(dir));
  }
  let home = env::var_os("HOME").map(PathBuf::from);
  let base = if cfg!(target_os = "macos") {
    home.map(|home| home.join("Library/Application Support"))
  } else if cfg!(windows) {
    env::var_os("APPDATA").map(PathBuf::from)
  } else {
    env::var_os("XDG_DATA_HOME")
      .map(PathBuf::from)
      .or_else(|| home.map(|home| home.join(".local/share")))
  };
  base.map(|base| base.join(APP_ID))
}

struct Target {
  port: u16,
  token: String,
}

/// What `mcp.json` says: the running server, and whether MCP is switched on.
#[derive(Default)]
struct AppState {
  target: Option<Target>,
  /// None before the app first saved its settings.
  enabled: Option<bool>,
}

fn read_state(dir: &Path) -> AppState {
  let Some(value) = fs::read_to_string(dir.join(STATE_FILE))
    .ok()
    .and_then(|text| serde_json::from_str::<Value>(&text).ok())
  else {
    return AppState::default();
  };
  let target = (|| {
    Some(Target {
      port: u16::try_from(value["port"].as_u64()?).ok()?,
      token: value["token"].as_str()?.to_string(),
    })
  })();
  AppState {
    target,
    enabled: value["settings"]["enabled"].as_bool(),
  }
}

/// Whether `processes` (`ps -axo comm=`, one executable path per line) has
/// the app running from `bundle`. The bridges there (`own`) do not count.
fn app_running(processes: &str, bundle: &Path, own: &str) -> bool {
  let executables = bundle.join("Contents").join("MacOS");
  processes.lines().map(Path::new).any(|exe| {
    exe.parent() == Some(executables.as_path())
      && exe.file_name().is_some_and(|name| name != own)
  })
}

/// Opens Angaria in the background: `open -g -j` neither shows nor
/// activates it, and the app keeps its window hidden for `--background`.
/// An app already running (still starting its server) is left alone: `open`
/// would make it reopen, which shows its window.
fn open_in_background(bundle: &Path) -> bool {
  let own = env::current_exe()
    .ok()
    .and_then(|exe| exe.file_name().map(|name| name.to_string_lossy().into_owned()))
    .unwrap_or_default();
  let running = Command::new("ps")
    .args(["-axo", "comm="])
    .output()
    .is_ok_and(|out| app_running(&String::from_utf8_lossy(&out.stdout), bundle, &own));
  if running {
    return true;
  }
  Command::new("open")
    .args(["-g", "-j", "-a"])
    .arg(bundle)
    .arg("--args")
    .args(LAUNCH_ARGS)
    .status()
    .is_ok_and(|status| status.success())
}

/// The .app bundle this binary sits in (Contents/MacOS/angaria-mcp).
fn app_bundle(exe: &Path) -> Option<PathBuf> {
  exe
    .ancestors()
    .find(|dir| dir.extension().is_some_and(|ext| ext == "app"))
    .map(Path::to_path_buf)
}

/// Visible ASCII as is; anything else in the `=?base64?...?=` form MCP defines.
fn header_safe(value: &str) -> String {
  let plain = value.bytes().all(|byte| (0x20..0x7f).contains(&byte))
    && value.trim() == value
    && !(value.starts_with("=?base64?") && value.ends_with("?="));
  if plain {
    value.to_string()
  } else {
    format!(
      "=?base64?{}?=",
      base64::engine::general_purpose::STANDARD.encode(value)
    )
  }
}

/// The MCP headers of `message`: a modern request mirrors its version, method
/// and tool name; a legacy one sends the version `initialize` agreed on.
fn mcp_headers(message: &Value, negotiated: Option<&str>) -> Vec<(&'static str, String)> {
  let mut headers = Vec::new();
  let modern = message["params"]["_meta"][META_VERSION].as_str();
  if let Some(version) = modern.or(negotiated) {
    headers.push(("MCP-Protocol-Version", header_safe(version)));
  }
  if modern.is_some() {
    if let Some(method) = message["method"].as_str() {
      headers.push(("Mcp-Method", header_safe(method)));
    }
    let params = &message["params"];
    if let Some(name) = params["name"].as_str().or_else(|| params["uri"].as_str()) {
      headers.push(("Mcp-Name", header_safe(name)));
    }
  }
  headers
}

enum PostError {
  /// Nothing was sent: the server is not there.
  Connect,
  /// The request went out; it must not be sent again.
  Lost,
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
  haystack
    .windows(needle.len())
    .position(|window| window == needle)
}

fn dechunk(mut body: &[u8]) -> Option<Vec<u8>> {
  let mut out = Vec::new();
  loop {
    let line_end = find(body, b"\r\n")?;
    let size_text = std::str::from_utf8(&body[..line_end]).ok()?;
    let size = usize::from_str_radix(size_text.split(';').next()?.trim(), 16).ok()?;
    body = &body[line_end + 2..];
    if size == 0 {
      return Some(out);
    }
    out.extend_from_slice(body.get(..size)?);
    body = body.get(size + 2..)?;
  }
}

/// Status and body of a whole HTTP/1.1 response.
fn parse_response(raw: &[u8]) -> Option<(u16, Vec<u8>)> {
  let head_end = find(raw, b"\r\n\r\n")?;
  let head = std::str::from_utf8(&raw[..head_end]).ok()?;
  let status = head.split(' ').nth(1)?.parse().ok()?;
  let body = &raw[head_end + 4..];
  let chunked = head.lines().skip(1).any(|line| {
    line.split_once(':').is_some_and(|(name, value)| {
      name.trim().eq_ignore_ascii_case("transfer-encoding")
        && value.trim().eq_ignore_ascii_case("chunked")
    })
  });
  let body = if chunked {
    dechunk(body)?
  } else {
    body.to_vec()
  };
  Some((status, body))
}

/// Sends one request on its own connection. `opened` gets a handle to the
/// connection once it is up, so a cancellation can close it.
fn post(
  target: &Target,
  headers: &[(&'static str, String)],
  body: &[u8],
  opened: impl FnOnce(&TcpStream),
) -> Result<(u16, Vec<u8>), PostError> {
  let address = SocketAddr::from(([127, 0, 0, 1], target.port));
  let mut stream = TcpStream::connect_timeout(&address, Duration::from_secs(2))
    .map_err(|_| PostError::Connect)?;
  opened(&stream);
  let mut head = format!(
    "POST /mcp HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nAuthorization: Bearer {}\r\n\
     Content-Type: application/json\r\nAccept: application/json, text/event-stream\r\n\
     Content-Length: {}\r\nConnection: close\r\n",
    target.port,
    target.token,
    body.len()
  );
  for (name, value) in headers {
    head.push_str(&format!("{name}: {value}\r\n"));
  }
  head.push_str("\r\n");
  let mut raw = Vec::new();
  stream
    .set_read_timeout(Some(READ_TIMEOUT))
    .and_then(|()| stream.write_all(head.as_bytes()))
    .and_then(|()| stream.write_all(body))
    .and_then(|()| stream.read_to_end(&mut raw))
    .map_err(|_| PostError::Lost)?;
  parse_response(&raw).ok_or(PostError::Lost)
}

fn error_reply(id: Value, message: &str) -> Value {
  json!({ "jsonrpc": "2.0", "id": id, "error": { "code": INTERNAL_ERROR, "message": message } })
}

type Launcher = Box<dyn Fn() -> bool + Send + Sync>;

struct Bridge {
  dir: Option<PathBuf>,
  /// Opens Angaria; false when it cannot (no app bundle around the bridge).
  launcher: Launcher,
  /// The legacy protocol version `initialize` agreed on.
  negotiated: Mutex<Option<String>>,
  launched_at: Mutex<Option<Instant>>,
  /// Requests in flight by JSON-RPC id.
  flights: Mutex<HashMap<String, Flight>>,
}

/// A request in flight: its connection once open, and whether the client
/// cancelled it (then it gets no answer).
#[derive(Default)]
struct Flight {
  cancelled: bool,
  stream: Option<TcpStream>,
}

impl Bridge {
  fn new(dir: Option<PathBuf>, bundle: Option<PathBuf>) -> Self {
    let launcher: Launcher = match bundle {
      Some(bundle) => Box::new(move || open_in_background(&bundle)),
      None => Box::new(|| false),
    };
    Self::with_launcher(dir, launcher)
  }

  fn with_launcher(dir: Option<PathBuf>, launcher: Launcher) -> Self {
    Self {
      dir,
      launcher,
      negotiated: Mutex::new(None),
      launched_at: Mutex::new(None),
      flights: Mutex::new(HashMap::new()),
    }
  }

  fn state(&self) -> AppState {
    self.dir.as_deref().map(read_state).unwrap_or_default()
  }

  /// Opens Angaria in the background, at most once a minute. True while it
  /// may still be starting, so the caller waits for its server.
  fn launch(&self) -> bool {
    let mut launched_at = self.launched_at.lock().unwrap();
    match *launched_at {
      Some(at) if at.elapsed() < LAUNCH_WAIT => return true,
      // Opened a moment ago and still not serving: its MCP server is off.
      Some(at) if at.elapsed() < LAUNCH_AGAIN_AFTER => return false,
      _ => {}
    }
    let launched = (self.launcher)();
    if launched {
      *launched_at = Some(Instant::now());
    }
    launched
  }

  fn is_cancelled(&self, key: &str) -> bool {
    self
      .flights
      .lock()
      .unwrap()
      .get(key)
      .is_some_and(|flight| flight.cancelled)
  }

  /// `notifications/cancelled` for a request in flight: closing its
  /// connection is how Streamable HTTP cancels, and the server stops the call.
  fn cancel(&self, key: &str) {
    if let Some(flight) = self.flights.lock().unwrap().get_mut(key) {
      flight.cancelled = true;
      if let Some(stream) = flight.stream.take() {
        let _ = stream.shutdown(Shutdown::Both);
      }
    }
  }

  /// Keeps a handle to the request's connection, or closes it when the
  /// request was cancelled meanwhile.
  fn opened(&self, key: &str, stream: &TcpStream) {
    let Ok(handle) = stream.try_clone() else {
      return;
    };
    if let Some(flight) = self.flights.lock().unwrap().get_mut(key) {
      if flight.cancelled {
        let _ = handle.shutdown(Shutdown::Both);
      } else {
        flight.stream = Some(handle);
      }
    }
  }

  /// Posts request `key`, opening Angaria and waiting for its server when
  /// nothing listens, unless its MCP switch is off. Never sends again once a
  /// connection was open.
  fn send(
    &self,
    key: &str,
    headers: &[(&'static str, String)],
    body: &[u8],
  ) -> Result<(u16, Vec<u8>), &'static str> {
    let attempt = |target: &Target| {
      let result = post(target, headers, body, |stream| self.opened(key, stream));
      if let Some(flight) = self.flights.lock().unwrap().get_mut(key) {
        flight.stream = None;
      }
      result
    };
    if self.is_cancelled(key) {
      return Err(NOT_REACHABLE);
    }
    let state = self.state();
    if let Some(target) = state.target {
      match attempt(&target) {
        Ok(response) => return Ok(response),
        Err(PostError::Lost) => return Err(CONNECTION_LOST),
        Err(PostError::Connect) => {}
      }
    }
    if state.enabled == Some(false) {
      return Err(MCP_OFF);
    }
    if !self.launch() {
      return Err(NOT_REACHABLE);
    }
    let deadline = Instant::now() + LAUNCH_WAIT;
    while Instant::now() < deadline && !self.is_cancelled(key) {
      thread::sleep(Duration::from_millis(250));
      let state = self.state();
      if let Some(target) = state.target {
        match attempt(&target) {
          Ok(response) => return Ok(response),
          Err(PostError::Lost) => return Err(CONNECTION_LOST),
          Err(PostError::Connect) => {}
        }
      }
      // A first launch learns the switch from the app's webview.
      if state.enabled == Some(false) {
        return Err(MCP_OFF);
      }
    }
    Err(NOT_REACHABLE)
  }

  /// The answer to write back for `message`, none for a notification or a
  /// cancelled request.
  fn forward(&self, message: &Value) -> Option<Value> {
    let negotiated = self.negotiated.lock().unwrap().clone();
    let headers = mcp_headers(message, negotiated.as_deref());
    let Some(id) = message.get("id").cloned().filter(|_| message.get("method").is_some()) else {
      if message["method"] == "notifications/cancelled" {
        if let Some(request) = message["params"].get("requestId") {
          self.cancel(&request.to_string());
        }
        return None;
      }
      // A notification goes to a running server only: it never opens Angaria.
      if let Some(target) = self.state().target {
        let _ = post(&target, &headers, message.to_string().as_bytes(), |_| {});
      }
      return None;
    };
    let key = id.to_string();
    self.flights.lock().unwrap().insert(key.clone(), Flight::default());
    let outcome = self.send(&key, &headers, message.to_string().as_bytes());
    let flight = self.flights.lock().unwrap().remove(&key);
    if flight.is_some_and(|flight| flight.cancelled) {
      return None;
    }
    let (status, body) = match outcome {
      Ok(response) => response,
      Err(text) => return Some(error_reply(id, text)),
    };
    let reply = serde_json::from_slice::<Value>(&body)
      .ok()
      .filter(|reply| reply.get("result").is_some() || reply.get("error").is_some());
    let Some(mut reply) = reply else {
      return Some(error_reply(
        id,
        &format!("Angaria beklenmeyen bir yanıt verdi (HTTP {status})."),
      ));
    };
    if message["method"] == "initialize" {
      if let Some(version) = reply["result"]["protocolVersion"].as_str() {
        *self.negotiated.lock().unwrap() = Some(version.to_string());
      }
    }
    // A refusal before the server read the body names no id.
    if reply.get("id").map_or(true, Value::is_null) {
      reply["id"] = id;
    }
    Some(reply)
  }
}

fn write_line(out: &Mutex<io::Stdout>, value: &Value) {
  let mut out = out.lock().unwrap();
  let _ = writeln!(out, "{value}");
  let _ = out.flush();
}

fn main() {
  let bridge = Arc::new(Bridge::new(
    data_dir(),
    env::current_exe()
      .ok()
      .and_then(|exe| exe.canonicalize().ok())
      .and_then(|exe| app_bundle(&exe)),
  ));
  let out = Arc::new(Mutex::new(io::stdout()));
  let mut running = Vec::new();
  for line in io::stdin().lock().lines() {
    let Ok(line) = line else {
      break;
    };
    if line.trim().is_empty() {
      continue;
    }
    let message = match serde_json::from_str::<Value>(&line) {
      Ok(message) if message.is_object() => message,
      _ => {
        let reply = json!({ "jsonrpc": "2.0", "id": null, "error": { "code": -32700, "message": "Parse error" } });
        write_line(&out, &reply);
        continue;
      }
    };
    // initialize settles the version later messages send, and notifications
    // keep their order; other requests run side by side, so a slow GİB call
    // does not hold up a ping.
    let inline = message["method"] == "initialize" || message.get("id").is_none();
    if inline {
      if let Some(reply) = bridge.forward(&message) {
        write_line(&out, &reply);
      }
    } else {
      let bridge = bridge.clone();
      let out = out.clone();
      running.retain(|handle: &thread::JoinHandle<()>| !handle.is_finished());
      running.push(thread::spawn(move || {
        if let Some(reply) = bridge.forward(&message) {
          write_line(&out, &reply);
        }
      }));
    }
  }
  // stdin closed: answer what is still in flight before exiting.
  for handle in running {
    let _ = handle.join();
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn modern_requests_mirror_their_metadata() {
    let message = json!({
      "jsonrpc": "2.0", "id": 1, "method": "tools/call",
      "params": { "name": "list_invoices", "_meta": { META_VERSION: "2026-07-28" } },
    });
    assert_eq!(
      mcp_headers(&message, Some("2025-06-18")),
      vec![
        ("MCP-Protocol-Version", "2026-07-28".to_string()),
        ("Mcp-Method", "tools/call".to_string()),
        ("Mcp-Name", "list_invoices".to_string()),
      ]
    );
  }

  #[test]
  fn legacy_requests_send_the_negotiated_version() {
    let message = json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list" });
    assert_eq!(mcp_headers(&message, None), vec![]);
    assert_eq!(
      mcp_headers(&message, Some("2025-06-18")),
      vec![("MCP-Protocol-Version", "2025-06-18".to_string())]
    );
  }

  #[test]
  fn header_values_outside_ascii_are_base64() {
    assert_eq!(header_safe("list_invoices"), "list_invoices");
    assert_eq!(header_safe("Hello, 世界"), "=?base64?SGVsbG8sIOS4lueVjA==?=");
    assert_eq!(header_safe(" padded "), "=?base64?IHBhZGRlZCA=?=");
    assert_eq!(
      header_safe("=?base64?literal?="),
      "=?base64?PT9iYXNlNjQ/bGl0ZXJhbD89?="
    );
  }

  #[test]
  fn reads_responses_with_and_without_chunks() {
    let plain = b"HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: 2\r\n\r\n{}";
    assert_eq!(parse_response(plain), Some((200, b"{}".to_vec())));
    let chunked = b"HTTP/1.1 400 Bad Request\r\nTransfer-Encoding: chunked\r\n\r\n3\r\n{\"a\r\n4\r\n\":1}\r\n0\r\n\r\n";
    assert_eq!(parse_response(chunked), Some((400, b"{\"a\":1}".to_vec())));
    assert_eq!(
      parse_response(b"HTTP/1.1 202 Accepted\r\n\r\n"),
      Some((202, vec![]))
    );
    assert_eq!(parse_response(b"garbage"), None);
  }

  #[test]
  fn finds_the_app_bundle_around_the_binary() {
    assert_eq!(
      app_bundle(Path::new("/Applications/Angaria.app/Contents/MacOS/angaria-mcp")),
      Some(PathBuf::from("/Applications/Angaria.app"))
    );
    assert_eq!(
      app_bundle(Path::new("/repo/src-tauri/target/debug/angaria-mcp")),
      None
    );
  }

  #[test]
  fn reads_the_port_and_token_the_app_wrote() {
    let dir = env::temp_dir().join(format!("angaria-bridge-{}", std::process::id()));
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join(STATE_FILE), r#"{"token":"abc","port":41234}"#).unwrap();
    let state = read_state(&dir);
    let target = state.target.unwrap();
    assert_eq!((target.port, target.token.as_str()), (41234, "abc"));
    assert_eq!(state.enabled, None);
    fs::write(
      dir.join(STATE_FILE),
      r#"{"token":"abc","port":null,"settings":{"enabled":false}}"#,
    )
    .unwrap();
    let state = read_state(&dir);
    assert!(state.target.is_none());
    assert_eq!(state.enabled, Some(false));
    fs::remove_dir_all(dir).unwrap();
  }

  fn state_dir(name: &str, port: u16) -> PathBuf {
    let dir = env::temp_dir().join(format!("angaria-bridge-{name}-{}", std::process::id()));
    fs::create_dir_all(&dir).unwrap();
    fs::write(
      dir.join(STATE_FILE),
      format!(r#"{{"token":"abc","port":{port}}}"#),
    )
    .unwrap();
    dir
  }

  #[test]
  fn a_cancelled_request_closes_its_connection_and_gets_no_answer() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    // A server that reads the request, then waits for the client to hang up.
    let server = thread::spawn(move || {
      let (mut stream, _) = listener.accept().unwrap();
      let mut seen = Vec::new();
      let mut buffer = [0u8; 1024];
      while let Ok(read) = stream.read(&mut buffer) {
        if read == 0 {
          break;
        }
        seen.extend_from_slice(&buffer[..read]);
      }
      String::from_utf8(seen).unwrap()
    });
    let dir = state_dir("cancel", port);
    let bridge = Arc::new(Bridge::new(Some(dir.clone()), None));
    let request = json!({ "jsonrpc": "2.0", "id": 5, "method": "tools/call", "params": { "name": "x" } });
    let worker = {
      let bridge = bridge.clone();
      thread::spawn(move || bridge.forward(&request))
    };
    while !bridge
      .flights
      .lock()
      .unwrap()
      .get("5")
      .is_some_and(|flight| flight.stream.is_some())
    {
      thread::sleep(Duration::from_millis(10));
    }
    let note = json!({ "jsonrpc": "2.0", "method": "notifications/cancelled", "params": { "requestId": 5 } });
    assert!(bridge.forward(&note).is_none());
    assert!(worker.join().unwrap().is_none());
    assert!(server.join().unwrap().contains("Authorization: Bearer abc"));
    assert!(bridge.flights.lock().unwrap().is_empty());
    // A late cancellation of a finished request marks nothing.
    bridge.cancel("5");
    assert!(bridge.flights.lock().unwrap().is_empty());
    fs::remove_dir_all(dir).unwrap();
  }

  #[test]
  fn a_running_app_is_found_by_its_bundle_and_not_by_a_bridge() {
    let bundle = Path::new("/Applications/Angaria.app");
    let others = "/sbin/launchd\n/Applications/Other.app/Contents/MacOS/Angaria\n";
    let bridge = "/Applications/Angaria.app/Contents/MacOS/angaria-mcp\n";
    let app = "/Applications/Angaria.app/Contents/MacOS/Angaria\n";
    assert!(!app_running(others, bundle, "angaria-mcp"));
    assert!(!app_running(&format!("{others}{bridge}"), bundle, "angaria-mcp"));
    assert!(app_running(&format!("{others}{bridge}{app}"), bundle, "angaria-mcp"));
  }

  #[test]
  fn notifications_never_open_angaria() {
    let bridge = Bridge::new(None, Some(PathBuf::from("/nonexistent/Angaria.app")));
    let started = Instant::now();
    let note = json!({ "jsonrpc": "2.0", "method": "notifications/initialized" });
    assert!(bridge.forward(&note).is_none());
    assert!(bridge.launched_at.lock().unwrap().is_none());
    assert!(started.elapsed() < Duration::from_secs(1));
  }

  #[test]
  fn a_closed_app_is_a_turkish_error_for_requests_only() {
    let bridge = Bridge::new(None, None);
    let request = json!({ "jsonrpc": "2.0", "id": 7, "method": "tools/list" });
    let reply = bridge.forward(&request).unwrap();
    assert_eq!(reply["id"], 7);
    assert_eq!(reply["error"]["message"], NOT_REACHABLE);
    let note = json!({ "jsonrpc": "2.0", "method": "notifications/initialized" });
    assert!(bridge.forward(&note).is_none());
  }

  /// A server that answers one request with `reply` and returns what it read.
  fn answer_once(reply: Value) -> (u16, thread::JoinHandle<String>) {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = thread::spawn(move || {
      let (mut stream, _) = listener.accept().unwrap();
      let mut seen = Vec::new();
      let mut buffer = [0u8; 4096];
      loop {
        let read = stream.read(&mut buffer).unwrap();
        seen.extend_from_slice(&buffer[..read]);
        let Some(head_end) = find(&seen, b"\r\n\r\n") else {
          continue;
        };
        let head = String::from_utf8_lossy(&seen[..head_end]).to_lowercase();
        let length: usize = head
          .lines()
          .find_map(|line| line.strip_prefix("content-length:"))
          .map_or(0, |value| value.trim().parse().unwrap());
        if read == 0 || seen.len() >= head_end + 4 + length {
          break;
        }
      }
      let body = reply.to_string();
      write!(
        stream,
        "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\n\r\n{body}",
        body.len()
      )
      .unwrap();
      String::from_utf8(seen).unwrap()
    });
    (port, server)
  }

  fn empty_dir(name: &str, content: &str) -> PathBuf {
    let dir = env::temp_dir().join(format!("angaria-bridge-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join(STATE_FILE), content).unwrap();
    dir
  }

  #[test]
  fn a_cold_start_opens_angaria_and_forwards_once_its_server_listens() {
    let reply = json!({ "jsonrpc": "2.0", "id": 9, "result": { "tools": [] } });
    let (port, server) = answer_once(reply.clone());
    // Never opened before: no port, no settings.
    let dir = empty_dir("cold", r#"{"token":"abc"}"#);
    let launches = Arc::new(Mutex::new(0));
    let launcher: Launcher = {
      let (dir, launches) = (dir.clone(), launches.clone());
      Box::new(move || {
        *launches.lock().unwrap() += 1;
        // The app starts a moment later and writes its port.
        let (dir, state) = (
          dir.clone(),
          format!(r#"{{"token":"abc","port":{port},"settings":{{"enabled":true}}}}"#),
        );
        thread::spawn(move || {
          thread::sleep(Duration::from_millis(300));
          fs::write(dir.join(STATE_FILE), state).unwrap();
        });
        true
      })
    };
    let bridge = Bridge::with_launcher(Some(dir.clone()), launcher);
    let request = json!({ "jsonrpc": "2.0", "id": 9, "method": "tools/list" });
    assert_eq!(bridge.forward(&request), Some(reply));
    assert_eq!(*launches.lock().unwrap(), 1);
    assert!(server.join().unwrap().contains("Authorization: Bearer abc"));
    fs::remove_dir_all(dir).unwrap();
  }

  #[test]
  fn mcp_switched_off_is_an_error_without_opening_angaria() {
    let dir = empty_dir("off", r#"{"token":"abc","settings":{"enabled":false}}"#);
    let bridge = Bridge::with_launcher(
      Some(dir.clone()),
      Box::new(|| panic!("opened Angaria with MCP off")),
    );
    let request = json!({ "jsonrpc": "2.0", "id": 3, "method": "tools/list" });
    let reply = bridge.forward(&request).unwrap();
    assert_eq!(reply["id"], 3);
    assert_eq!(reply["error"]["message"], MCP_OFF);
    fs::remove_dir_all(dir).unwrap();
  }

  #[test]
  fn a_first_launch_that_finds_mcp_off_answers_at_once() {
    let dir = empty_dir("first-off", r#"{"token":"abc"}"#);
    let launcher: Launcher = {
      let dir = dir.clone();
      // The webview saves its settings: MCP was never switched on.
      Box::new(move || {
        fs::write(
          dir.join(STATE_FILE),
          r#"{"token":"abc","settings":{"enabled":false}}"#,
        )
        .unwrap();
        true
      })
    };
    let bridge = Bridge::with_launcher(Some(dir.clone()), launcher);
    let started = Instant::now();
    let request = json!({ "jsonrpc": "2.0", "id": 4, "method": "tools/list" });
    assert_eq!(bridge.forward(&request).unwrap()["error"]["message"], MCP_OFF);
    assert!(started.elapsed() < Duration::from_secs(2));
    fs::remove_dir_all(dir).unwrap();
  }
}
