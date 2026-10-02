//! The built-in MCP server: Streamable HTTP on 127.0.0.1, only while the app
//! has it switched on. Every request needs a loopback Host (DNS rebinding), no
//! Origin (a web page), and the install's bearer token; there are no CORS
//! headers. Tool calls go to a `ToolHost`: the webview in the app (mod.rs),
//! stdio in the end-to-end harness (examples/mcp_harness.rs).

use std::collections::HashMap;
use std::convert::Infallible;
use std::io;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use http_body_util::{BodyExt, Full, Limited};
use hyper::body::{Bytes, Incoming};
use hyper::header::{HeaderMap, HeaderValue, ALLOW, CONTENT_TYPE, WWW_AUTHENTICATE};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode};
use hyper_util::rt::{TokioIo, TokioTimer};
use serde::Serialize;
use serde_json::{json, Value};
use tokio::net::TcpListener;
use tokio::sync::{oneshot, watch};

use super::rpc::{self, ClientInfo, McpHeaders, Outcome};

pub const MCP_PATH: &str = "/mcp";
const MAX_BODY_BYTES: usize = 1024 * 1024;
/// The webview stops waiting for a busy GİB queue before this.
const TOOL_TIMEOUT: Duration = Duration::from_secs(120);
const MAX_CALLS_IN_FLIGHT: usize = 8;
const MAX_CLIENTS: usize = 8;

/// One tools/call for whoever runs the tools.
#[derive(Debug, Clone, Serialize)]
pub struct ToolCall {
  pub id: u64,
  pub name: String,
  pub arguments: Value,
}

pub trait ToolHost: Send + Sync + 'static {
  /// Starts `call`; its CallToolResult arrives on the receiver.
  fn dispatch(&self, call: ToolCall) -> oneshot::Receiver<Value>;
  /// The server stopped waiting for `id`.
  fn cancel(&self, id: u64);
}

/// Pending calls by id, for hosts that answer from elsewhere.
#[derive(Default)]
pub struct Pending(Mutex<HashMap<u64, oneshot::Sender<Value>>>);

impl Pending {
  pub fn add(&self, id: u64) -> oneshot::Receiver<Value> {
    let (tx, rx) = oneshot::channel();
    self.0.lock().unwrap().insert(id, tx);
    rx
  }

  /// Hands `result` to the call waiting on `id`; false when none waits.
  pub fn resolve(&self, id: u64, result: Value) -> bool {
    match self.0.lock().unwrap().remove(&id) {
      Some(tx) => tx.send(result).is_ok(),
      None => false,
    }
  }

  pub fn remove(&self, id: u64) {
    self.0.lock().unwrap().remove(&id);
  }
}

/// A client that named itself, and when it was last seen (ms since the epoch).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientSeen {
  pub name: String,
  pub version: String,
  pub last_seen: u64,
}

struct Shared {
  port: u16,
  token: RwLock<String>,
  tools: RwLock<Value>,
  clients: Mutex<Vec<ClientSeen>>,
  host: Arc<dyn ToolHost>,
  in_flight: AtomicUsize,
  server_version: String,
}

pub struct ServerOptions {
  /// The first port to try; 0 lets the system pick one.
  pub port: u16,
  /// How many ports from `port` on to try before giving up.
  pub attempts: u16,
  pub token: String,
  pub tools: Value,
  pub host: Arc<dyn ToolHost>,
  pub server_version: String,
}

pub struct RunningServer {
  /// The port asked for; `port()` is the one it got.
  pub requested_port: u16,
  shared: Arc<Shared>,
  shutdown: watch::Sender<bool>,
  task: tokio::task::JoinHandle<()>,
}

impl RunningServer {
  pub fn port(&self) -> u16 {
    self.shared.port
  }

  pub fn set_tools(&self, tools: Value) {
    *self.shared.tools.write().unwrap() = tools;
  }

  pub fn set_token(&self, token: String) {
    *self.shared.token.write().unwrap() = token;
  }

  pub fn clients(&self) -> Vec<ClientSeen> {
    self.shared.clients.lock().unwrap().clone()
  }

  /// Stops listening and closes open connections once their request is answered.
  pub async fn stop(self) {
    let _ = self.shutdown.send(true);
    let _ = self.task.await;
  }
}

async fn bind(port: u16, attempts: u16) -> io::Result<TcpListener> {
  let mut last = io::Error::new(io::ErrorKind::AddrInUse, "no port to try");
  for offset in 0..attempts.max(1) {
    let Some(candidate) = port.checked_add(offset) else {
      break;
    };
    match TcpListener::bind(("127.0.0.1", candidate)).await {
      Ok(listener) => return Ok(listener),
      Err(error) => last = error,
    }
    if port == 0 {
      break;
    }
  }
  Err(last)
}

pub async fn start(options: ServerOptions) -> io::Result<RunningServer> {
  let listener = bind(options.port, options.attempts).await?;
  let shared = Arc::new(Shared {
    port: listener.local_addr()?.port(),
    token: RwLock::new(options.token),
    tools: RwLock::new(options.tools),
    clients: Mutex::new(Vec::new()),
    host: options.host,
    in_flight: AtomicUsize::new(0),
    server_version: options.server_version,
  });
  let (shutdown, mut stopped) = watch::channel(false);
  let accept_shared = shared.clone();
  let task = tokio::spawn(async move {
    loop {
      tokio::select! {
        _ = stopped.changed() => break,
        accepted = listener.accept() => {
          let Ok((stream, _)) = accepted else { continue };
          let shared = accept_shared.clone();
          let mut stopped = stopped.clone();
          tokio::spawn(async move {
            let service = service_fn(move |request| handle(request, shared.clone()));
            let connection = http1::Builder::new()
              .timer(TokioTimer::new())
              .header_read_timeout(Duration::from_secs(10))
              .serve_connection(TokioIo::new(stream), service);
            tokio::pin!(connection);
            tokio::select! {
              _ = connection.as_mut() => {}
              _ = stopped.changed() => {
                connection.as_mut().graceful_shutdown();
                let _ = connection.await;
              }
            }
          });
        }
      }
    }
  });
  Ok(RunningServer {
    requested_port: options.port,
    shared,
    shutdown,
    task,
  })
}

type Reply = Response<Full<Bytes>>;

fn json_reply(status: StatusCode, body: &Value) -> Reply {
  let mut response = Response::new(Full::new(Bytes::from(body.to_string())));
  *response.status_mut() = status;
  response
    .headers_mut()
    .insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
  response
}

fn refuse(status: StatusCode, message: &str) -> Reply {
  json_reply(
    status,
    &json!({ "jsonrpc": "2.0", "error": { "code": -32600, "message": message } }),
  )
}

/// Loopback names only, on this server's port: any other Host is a DNS rebinding attempt.
fn host_allowed(host: Option<&str>, port: u16) -> bool {
  let Some(host) = host else {
    return false;
  };
  let (name, host_port) = match host.rsplit_once(':') {
    Some((name, rest)) if !rest.contains(']') => (name, Some(rest)),
    _ => (host, None),
  };
  let loopback = matches!(
    name.to_ascii_lowercase().as_str(),
    "127.0.0.1" | "localhost" | "[::1]"
  );
  loopback && host_port.map_or(true, |value| value == port.to_string())
}

/// Constant time, so the comparison does not leak how much of a guess was right.
fn same_secret(a: &[u8], b: &[u8]) -> bool {
  a.len() == b.len() && a.iter().zip(b).fold(0u8, |diff, (x, y)| diff | (x ^ y)) == 0
}

fn header<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
  headers.get(name).and_then(|value| value.to_str().ok())
}

/// The checks every request passes before anything else: loopback Host, no
/// browser Origin, the bearer token. The refusal when one fails.
fn access_refusal(headers: &HeaderMap, port: u16, token: &str) -> Option<Reply> {
  if !host_allowed(header(headers, "host"), port) {
    log::warn!("MCP: refused Host {:?}", header(headers, "host"));
    return Some(refuse(StatusCode::FORBIDDEN, "Host not allowed"));
  }
  // MCP clients are not web pages; a browser always names the page's origin.
  if headers.contains_key("origin") {
    log::warn!("MCP: refused a request with Origin {:?}", header(headers, "origin"));
    return Some(refuse(StatusCode::FORBIDDEN, "Origin not allowed"));
  }
  let presented = header(headers, "authorization")
    .and_then(|value| value.strip_prefix("Bearer "))
    .unwrap_or("");
  if token.is_empty() || !same_secret(presented.as_bytes(), token.as_bytes()) {
    let mut reply = refuse(StatusCode::UNAUTHORIZED, "Unauthorized");
    reply
      .headers_mut()
      .insert(WWW_AUTHENTICATE, HeaderValue::from_static("Bearer"));
    return Some(reply);
  }
  None
}

fn now_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|time| time.as_millis() as u64)
    .unwrap_or(0)
}

fn note_client(shared: &Shared, client: ClientInfo) {
  let mut clients = shared.clients.lock().unwrap();
  clients.retain(|seen| seen.name != client.name);
  clients.insert(
    0,
    ClientSeen {
      name: client.name,
      version: client.version,
      last_seen: now_ms(),
    },
  );
  clients.truncate(MAX_CLIENTS);
}

/// Call ids for the whole process: a restarted server must not reuse the id
/// of a call the host still runs.
static NEXT_CALL_ID: AtomicU64 = AtomicU64::new(1);

/// A call in flight: counted until dropped, and cancelled at the host when it
/// is dropped unanswered (the client disconnected or the wait timed out).
struct InFlight<'a> {
  shared: &'a Shared,
  id: u64,
  answered: bool,
}

impl Drop for InFlight<'_> {
  fn drop(&mut self) {
    self.shared.in_flight.fetch_sub(1, Ordering::SeqCst);
    if !self.answered {
      self.shared.host.cancel(self.id);
    }
  }
}

async fn run_tool(shared: &Shared, name: String, arguments: Value) -> Value {
  if shared.in_flight.fetch_add(1, Ordering::SeqCst) >= MAX_CALLS_IN_FLIGHT {
    shared.in_flight.fetch_sub(1, Ordering::SeqCst);
    return rpc::tool_error("Angaria aynı anda çok fazla istek aldı. Biraz bekleyip tekrar dene.");
  }
  let id = NEXT_CALL_ID.fetch_add(1, Ordering::SeqCst);
  let mut call = InFlight {
    shared,
    id,
    answered: false,
  };
  let receiver = shared.host.dispatch(ToolCall {
    id,
    name,
    arguments,
  });
  match tokio::time::timeout(TOOL_TIMEOUT, receiver).await {
    Ok(Ok(result)) => {
      call.answered = true;
      result
    }
    Ok(Err(_)) => {
      call.answered = true;
      rpc::tool_error("Angaria bu aracı çalıştıramadı. Angaria açık mı?")
    }
    // The guard cancels the call at the host.
    Err(_) => rpc::tool_error(
      "Angaria zamanında yanıt vermedi. İşlem yine de tamamlanmış olabilir: tekrar denemeden önce list_invoices ile ya da Angaria’daki Faturalar’da kontrol et.",
    ),
  }
}

async fn handle(request: Request<Incoming>, shared: Arc<Shared>) -> Result<Reply, Infallible> {
  let token = shared.token.read().unwrap().clone();
  if let Some(reply) = access_refusal(request.headers(), shared.port, &token) {
    return Ok(reply);
  }
  if request.uri().path() != MCP_PATH {
    return Ok(refuse(StatusCode::NOT_FOUND, "Not found"));
  }
  if request.method() != Method::POST {
    // No GET stream and no sessions to DELETE.
    let mut reply = refuse(StatusCode::METHOD_NOT_ALLOWED, "Method not allowed");
    reply
      .headers_mut()
      .insert(ALLOW, HeaderValue::from_static("POST"));
    return Ok(reply);
  }
  let json_body = header(request.headers(), "content-type")
    .and_then(|value| value.split(';').next())
    .is_some_and(|value| value.trim().eq_ignore_ascii_case("application/json"));
  if !json_body {
    return Ok(refuse(
      StatusCode::UNSUPPORTED_MEDIA_TYPE,
      "Content-Type must be application/json",
    ));
  }
  let mcp_headers = McpHeaders {
    protocol_version: header(request.headers(), "mcp-protocol-version").map(String::from),
    method: header(request.headers(), "mcp-method").map(String::from),
    name: header(request.headers(), "mcp-name").map(String::from),
  };
  let body = match Limited::new(request.into_body(), MAX_BODY_BYTES)
    .collect()
    .await
  {
    Ok(collected) => collected.to_bytes(),
    Err(_) => return Ok(refuse(StatusCode::PAYLOAD_TOO_LARGE, "Body too large")),
  };

  let tools = shared.tools.read().unwrap().clone();
  let mut seen = Vec::new();
  let outcome = {
    let mut on_client = |client| seen.push(client);
    let mut ctx = rpc::Context {
      tools: &tools,
      server_version: &shared.server_version,
      on_client: &mut on_client,
    };
    rpc::route(&body, &mcp_headers, &mut ctx)
  };
  for client in seen {
    note_client(&shared, client);
  }

  Ok(match outcome {
    Outcome::Reply { status, body } => json_reply(
      StatusCode::from_u16(status).unwrap_or(StatusCode::BAD_REQUEST),
      &body,
    ),
    Outcome::Accepted => {
      let mut reply = Response::new(Full::new(Bytes::new()));
      *reply.status_mut() = StatusCode::ACCEPTED;
      reply
    }
    Outcome::Call {
      id,
      name,
      arguments,
      modern,
    } => {
      let result = run_tool(&shared, name, arguments).await;
      json_reply(StatusCode::OK, &rpc::tool_response(id, result, modern))
    }
  })
}

#[cfg(test)]
mod tests {
  use super::*;
  use tokio::io::{AsyncReadExt, AsyncWriteExt};

  const TOKEN: &str = "0123456789abcdef";

  /// Answers every call with its own name and arguments.
  struct Echo;

  impl ToolHost for Echo {
    fn dispatch(&self, call: ToolCall) -> oneshot::Receiver<Value> {
      let (tx, rx) = oneshot::channel();
      let _ = tx.send(json!({
        "content": [{ "type": "text", "text": json!({ "name": call.name, "arguments": call.arguments }).to_string() }],
      }));
      rx
    }

    fn cancel(&self, _id: u64) {}
  }

  async fn server() -> RunningServer {
    start(ServerOptions {
      port: 0,
      attempts: 1,
      token: TOKEN.into(),
      tools: json!([{ "name": "list_invoices", "inputSchema": { "type": "object" } }]),
      host: Arc::new(Echo),
      server_version: "0.0.0".into(),
    })
    .await
    .unwrap()
  }

  /// Sends a raw HTTP/1.1 request and returns the status and body.
  async fn send(port: u16, head: &str, body: &str) -> (u16, String) {
    let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port))
      .await
      .unwrap();
    let request = format!(
      "{head}Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
      body.len()
    );
    stream.write_all(request.as_bytes()).await.unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).await.unwrap();
    let status = response[9..12].parse().unwrap();
    let body = response
      .split_once("\r\n\r\n")
      .map(|(_, body)| body.to_string())
      .unwrap_or_default();
    (status, body)
  }

  fn post(port: u16, extra: &str) -> String {
    format!(
      "POST /mcp HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Type: application/json\r\n{extra}"
    )
  }

  const INITIALIZE: &str = r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}"#;

  #[tokio::test]
  async fn answers_an_authorized_loopback_request() {
    let server = server().await;
    let port = server.port();
    let auth = format!("Authorization: Bearer {TOKEN}\r\n");
    let (status, body) = send(port, &post(port, &auth), INITIALIZE).await;
    assert_eq!(status, 200, "{body}");
    assert!(body.contains("\"protocolVersion\":\"2025-06-18\""));
    assert_eq!(server.clients()[0].name, "test");

    let call = r#"{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_invoices","arguments":{"startDate":"01/10/2026"}}}"#;
    let (status, body) = send(port, &post(port, &auth), call).await;
    assert_eq!(status, 200);
    let reply: Value = serde_json::from_str(&body).unwrap();
    assert_eq!(reply["id"], 2);
    assert!(reply["result"]["content"][0]["text"]
      .as_str()
      .unwrap()
      .contains("01/10/2026"));
    server.stop().await;
  }

  #[tokio::test]
  async fn refuses_requests_without_the_token() {
    let server = server().await;
    let port = server.port();
    for auth in [
      String::new(),
      "Authorization: Bearer wrong-token-0000\r\n".into(),
      format!("Authorization: Basic {TOKEN}\r\n"),
      format!("Authorization: Bearer {TOKEN}x\r\n"),
    ] {
      let (status, _) = send(port, &post(port, &auth), INITIALIZE).await;
      assert_eq!(status, 401, "{auth}");
    }
    server.stop().await;
  }

  #[tokio::test]
  async fn refuses_browser_origins_and_foreign_hosts() {
    let server = server().await;
    let port = server.port();
    let auth = format!("Authorization: Bearer {TOKEN}\r\n");
    for origin in ["https://evil.example", "null", &format!("http://127.0.0.1:{port}")] {
      let extra = format!("{auth}Origin: {origin}\r\n");
      let (status, _) = send(port, &post(port, &extra), INITIALIZE).await;
      assert_eq!(status, 403, "{origin}");
    }
    for host in [
      format!("evil.example:{port}"),
      format!("127.0.0.1.evil.example:{port}"),
      "127.0.0.1:1".to_string(),
      "192.168.1.2".to_string(),
    ] {
      let head =
        format!("POST /mcp HTTP/1.1\r\nHost: {host}\r\nContent-Type: application/json\r\n{auth}");
      let (status, _) = send(port, &head, INITIALIZE).await;
      assert_eq!(status, 403, "{host}");
    }
    for host in [format!("localhost:{port}"), format!("[::1]:{port}")] {
      let head =
        format!("POST /mcp HTTP/1.1\r\nHost: {host}\r\nContent-Type: application/json\r\n{auth}");
      assert_eq!(send(port, &head, INITIALIZE).await.0, 200, "{host}");
    }
    server.stop().await;
  }

  #[tokio::test]
  async fn only_posts_json_to_the_mcp_path() {
    let server = server().await;
    let port = server.port();
    let auth = format!("Authorization: Bearer {TOKEN}\r\n");
    let get = format!("GET /mcp HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n{auth}");
    assert_eq!(send(port, &get, "").await.0, 405);
    let other = format!("POST /other HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Type: application/json\r\n{auth}");
    assert_eq!(send(port, &other, INITIALIZE).await.0, 404);
    let form = format!(
      "POST /mcp HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Type: text/plain\r\n{auth}"
    );
    assert_eq!(send(port, &form, INITIALIZE).await.0, 415);
    let note = r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#;
    assert_eq!(send(port, &post(port, &auth), note).await.0, 202);
    server.stop().await;
  }

  #[tokio::test]
  async fn a_new_token_replaces_the_old_one() {
    let server = server().await;
    let port = server.port();
    server.set_token("fedcba9876543210".into());
    let old = format!("Authorization: Bearer {TOKEN}\r\n");
    assert_eq!(send(port, &post(port, &old), INITIALIZE).await.0, 401);
    let new = "Authorization: Bearer fedcba9876543210\r\n";
    assert_eq!(send(port, &post(port, new), INITIALIZE).await.0, 200);
    server.stop().await;
  }

  #[tokio::test]
  async fn stopping_frees_the_port() {
    let server = server().await;
    let port = server.port();
    server.stop().await;
    assert!(tokio::net::TcpStream::connect(("127.0.0.1", port))
      .await
      .is_err());
  }

  #[tokio::test]
  async fn a_busy_port_falls_back_to_the_next_one() {
    let first = server().await;
    let taken = first.port();
    let second = start(ServerOptions {
      port: taken,
      attempts: 5,
      token: TOKEN.into(),
      tools: json!([]),
      host: Arc::new(Echo),
      server_version: "0.0.0".into(),
    })
    .await
    .unwrap();
    assert_ne!(second.port(), taken);
    assert!(second.port() > taken && second.port() < taken + 5);
    second.stop().await;
    first.stop().await;
  }

  /// Never answers; records cancellations.
  #[derive(Default)]
  struct Silent {
    pending: Pending,
    cancelled: Mutex<Vec<u64>>,
  }

  impl ToolHost for Silent {
    fn dispatch(&self, call: ToolCall) -> oneshot::Receiver<Value> {
      self.pending.add(call.id)
    }

    fn cancel(&self, id: u64) {
      self.cancelled.lock().unwrap().push(id);
    }
  }

  #[tokio::test]
  async fn a_client_that_disconnects_cancels_its_call() {
    let host = Arc::new(Silent::default());
    let server = start(ServerOptions {
      port: 0,
      attempts: 1,
      token: TOKEN.into(),
      tools: json!([{ "name": "list_invoices", "inputSchema": { "type": "object" } }]),
      host: host.clone(),
      server_version: "0.0.0".into(),
    })
    .await
    .unwrap();
    let port = server.port();
    let call = r#"{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_invoices"}}"#;
    let request = format!(
      "{}Authorization: Bearer {TOKEN}\r\nContent-Length: {}\r\n\r\n{call}",
      post(port, ""),
      call.len()
    );
    let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port))
      .await
      .unwrap();
    stream.write_all(request.as_bytes()).await.unwrap();
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert!(host.cancelled.lock().unwrap().is_empty());
    drop(stream);
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert_eq!(host.cancelled.lock().unwrap().len(), 1);
    server.stop().await;
  }

  #[test]
  fn host_names_must_be_loopback_on_this_port() {
    assert!(host_allowed(Some("127.0.0.1:41234"), 41234));
    assert!(host_allowed(Some("LOCALHOST:41234"), 41234));
    assert!(host_allowed(Some("[::1]:41234"), 41234));
    assert!(host_allowed(Some("[::1]"), 41234));
    assert!(host_allowed(Some("localhost"), 41234));
    assert!(!host_allowed(Some("127.0.0.1:41235"), 41234));
    assert!(!host_allowed(Some("evil.example:41234"), 41234));
    assert!(!host_allowed(Some("localhost.evil.example"), 41234));
    assert!(!host_allowed(None, 41234));
  }

  #[test]
  fn secrets_compare_whole() {
    assert!(same_secret(b"abc", b"abc"));
    assert!(!same_secret(b"abc", b"abd"));
    assert!(!same_secret(b"abc", b"abcd"));
    assert!(!same_secret(b"", b"a"));
  }
}
