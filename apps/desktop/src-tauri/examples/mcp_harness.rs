//! The built-in MCP server without the app window, for the end-to-end test
//! (apps/desktop/tests/mcp.e2e.ts). Tool calls go out on stdout as JSON lines
//! (`{"id","name","arguments"}`) and their results come back on stdin
//! (`{"id","result"}`), where the test runs them with the app's tool code.
//! `{"reload":true}` on stdin acts like the webview reloading (the calls it
//! ran are dropped, new ones wait) until `{"ready":true}`.
//!
//!   mcp_harness --dir <data dir> --tools <tools.json> [--port 0]
//!
//! Writes `mcp.json` (token and port) into the data dir like the app, so the
//! angaria-mcp bridge finds it through ANGARIA_MCP_DIR, then prints
//! `{"port": n}` once it listens.

use std::io::{self, BufRead, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use angaria_lib::mcp::files;
use angaria_lib::mcp::server::{self, HostGate, Pending, ServerOptions, ToolCall, ToolHost};
use serde_json::{json, Value};
use tokio::sync::{oneshot, watch};

struct StdioHost {
  pending: Pending,
  gate: HostGate,
  out: Mutex<io::Stdout>,
}

impl StdioHost {
  fn send(&self, line: &Value) {
    let mut out = self.out.lock().unwrap();
    writeln!(out, "{line}").unwrap();
    out.flush().unwrap();
  }
}

impl ToolHost for StdioHost {
  fn dispatch(&self, call: ToolCall) -> oneshot::Receiver<Value> {
    let receiver = self.pending.add(call.id);
    self.send(&json!(call));
    receiver
  }

  fn cancel(&self, id: u64) {
    self.pending.remove(id);
    self.send(&json!({ "cancel": id }));
  }

  fn ready(&self) -> watch::Receiver<bool> {
    self.gate.subscribe()
  }
}

fn argument(name: &str) -> Option<String> {
  let args: Vec<String> = std::env::args().collect();
  args
    .iter()
    .position(|arg| arg == name)
    .and_then(|index| args.get(index + 1).cloned())
}

#[tokio::main]
async fn main() {
  let dir = PathBuf::from(argument("--dir").expect("--dir <data dir>"));
  let tools_file = argument("--tools").expect("--tools <tools.json>");
  let tools: Value = serde_json::from_str(&std::fs::read_to_string(tools_file).unwrap()).unwrap();
  let port = argument("--port").map_or(0, |port| port.parse().unwrap());

  let host = Arc::new(StdioHost {
    pending: Pending::default(),
    gate: HostGate::new(true),
    out: Mutex::new(io::stdout()),
  });
  let running = server::start(ServerOptions {
    port,
    attempts: 1,
    token: files::ensure_token(&dir).unwrap(),
    tools,
    host: host.clone(),
    server_version: env!("CARGO_PKG_VERSION").into(),
  })
  .await
  .unwrap();
  files::set_port(&dir, Some(running.port())).unwrap();
  host.send(&json!({ "port": running.port() }));

  // Results arrive on stdin until it closes.
  let reader = host.clone();
  tokio::task::spawn_blocking(move || {
    for line in io::stdin().lock().lines() {
      let Ok(line) = line else { break };
      let Ok(message) = serde_json::from_str::<Value>(&line) else {
        continue;
      };
      if message["reload"] == true {
        reader.gate.set(false);
        reader.pending.clear();
      } else if message["ready"] == true {
        reader.gate.set(true);
      } else if let Some(id) = message["id"].as_u64() {
        reader.pending.resolve(id, message["result"].clone());
      }
    }
  })
  .await
  .unwrap();
  running.stop().await;
  files::set_port(&dir, None).unwrap();
}
