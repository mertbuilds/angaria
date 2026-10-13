//! MCP's JSON-RPC messages over Streamable HTTP, for both protocol eras:
//! modern requests (2026-07-28) carry their version in `params._meta` and in
//! headers, legacy clients (2025-11-25 and before) open with `initialize`.
//! Pure: the HTTP layer (server.rs) hands in the body and the MCP headers and
//! gets back what to answer, or the tool call to run.

use base64::Engine;
use serde_json::{json, Map, Value};

use super::inputs::{self, Notes};

pub const MODERN_VERSIONS: &[&str] = &["2026-07-28"];
/// Newest first: `initialize` answers with the first one for a version it does not know.
pub const LEGACY_VERSIONS: &[&str] = &["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
/// What a legacy request without an MCP-Protocol-Version header speaks.
const HEADERLESS_VERSION: &str = "2025-03-26";

const META_VERSION: &str = "io.modelcontextprotocol/protocolVersion";
const META_CAPABILITIES: &str = "io.modelcontextprotocol/clientCapabilities";
const META_CLIENT: &str = "io.modelcontextprotocol/clientInfo";
const META_SERVER: &str = "io.modelcontextprotocol/serverInfo";

const PARSE_ERROR: i64 = -32700;
const INVALID_REQUEST: i64 = -32600;
const METHOD_NOT_FOUND: i64 = -32601;
const INVALID_PARAMS: i64 = -32602;
const HEADER_MISMATCH: i64 = -32020;
const UNSUPPORTED_VERSION: i64 = -32022;

pub const SERVER_NAME: &str = "angaria";

/// How long a modern client may cache server/discover and tools/list
/// (CacheableResult.ttlMs): both are fixed while the app runs and change only
/// with an app update.
const CACHE_TTL_MS: u64 = 5 * 60 * 1000;

const INSTRUCTIONS: &str = "Angaria manages GİB e-Arşiv invoices for Turkish freelancers. Tools act on \
the company active in the Angaria app unless they name another (company: an id or VKN/TCKN from \
list_companies); naming one never switches the app. create_invoice and duplicate_invoice create \
unsigned drafts. A draft becomes a legal invoice once signed: request_signing_sms has GİB text the \
user an SMS code, and sign_invoices signs with the code the user gives you. Signing, deleting and \
changing company details work only while the user has allowed agent actions in Angaria; otherwise \
those tools say so. Never sign without the user's code for that request. Dates are DD/MM/YYYY. Tool \
messages are in Turkish; relay them to the user.";

/// The MCP headers of a request, as sent.
#[derive(Debug, Default)]
pub struct McpHeaders {
  pub protocol_version: Option<String>,
  pub method: Option<String>,
  pub name: Option<String>,
}

/// A client's self-reported name and version.
#[derive(Debug, Clone, PartialEq)]
pub struct ClientInfo {
  pub name: String,
  pub version: String,
}

#[derive(Debug, PartialEq)]
pub enum Outcome {
  /// Answer with this HTTP status and JSON body.
  Reply { status: u16, body: Value },
  /// A notification or a client's response: 202 without a body.
  Accepted,
  /// A tools/call for a known tool: run it, then answer with `tool_response`.
  Call {
    id: Value,
    name: String,
    arguments: Value,
    modern: bool,
  },
}

pub struct Context<'a> {
  /// The tool definitions the app registered, a JSON array.
  pub tools: &'a Value,
  /// What the server knows of each tool beyond the list (inputs.rs).
  pub notes: &'a Notes,
  pub server_version: &'a str,
  /// Told about every client that names itself.
  pub on_client: &'a mut dyn FnMut(ClientInfo),
}

fn error_body(id: Value, code: i64, message: &str, data: Option<Value>) -> Value {
  let mut error = json!({ "code": code, "message": message });
  if let Some(data) = data {
    error["data"] = data;
  }
  json!({ "jsonrpc": "2.0", "id": id, "error": error })
}

fn reply(status: u16, body: Value) -> Outcome {
  Outcome::Reply { status, body }
}

fn result_body(id: Value, result: Value) -> Value {
  json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

/// A finished 2026-07-28 result: `resultType` and the server's identity in `_meta`.
fn complete(mut result: Value, server_version: &str) -> Value {
  if let Some(object) = result.as_object_mut() {
    object.insert("resultType".into(), json!("complete"));
    let meta = object.entry("_meta").or_insert_with(|| json!({}));
    if let Some(meta) = meta.as_object_mut() {
      meta.insert(META_SERVER.into(), server_info(server_version));
    }
  }
  result
}

/// A 2026-07-28 CacheableResult. The token is per install, so no cache may
/// share it across users.
fn cacheable(mut result: Value) -> Value {
  result["ttlMs"] = json!(CACHE_TTL_MS);
  result["cacheScope"] = json!("private");
  result
}

/// The result of a tools/call, as the protocol era wants it: legacy results
/// stay as the tool gave them.
pub fn tool_response(id: Value, result: Value, modern: bool, server_version: &str) -> Value {
  if modern {
    result_body(id, complete(result, server_version))
  } else {
    result_body(id, result)
  }
}

/// A tool execution error the model can read (isError), in Turkish.
pub fn tool_error(message: &str) -> Value {
  json!({
    "content": [{ "type": "text", "text": json!({ "error": { "message": message } }).to_string() }],
    "isError": true,
  })
}

/// `=?base64?...?=` header values carry text that is not plain ASCII.
pub fn decode_header_value(value: &str) -> Option<String> {
  match value
    .strip_prefix("=?base64?")
    .and_then(|rest| rest.strip_suffix("?="))
  {
    Some(encoded) => base64::engine::general_purpose::STANDARD
      .decode(encoded)
      .ok()
      .and_then(|bytes| String::from_utf8(bytes).ok()),
    None => Some(value.to_string()),
  }
}

fn client_info(value: Option<&Value>) -> Option<ClientInfo> {
  let info = value?.as_object()?;
  Some(ClientInfo {
    name: info.get("name")?.as_str()?.to_string(),
    version: info
      .get("version")
      .and_then(Value::as_str)
      .unwrap_or("")
      .to_string(),
  })
}

fn server_info(version: &str) -> Value {
  json!({ "name": SERVER_NAME, "title": "Angaria", "version": version })
}

fn capabilities() -> Value {
  json!({ "tools": { "listChanged": false } })
}

fn known_tool(tools: &Value, name: &str) -> bool {
  tools
    .as_array()
    .is_some_and(|list| list.iter().any(|tool| tool["name"] == name))
}

/// Routes one POSTed message.
pub fn route(body: &[u8], headers: &McpHeaders, ctx: &mut Context) -> Outcome {
  let message: Value = match serde_json::from_slice(body) {
    Ok(value) => value,
    Err(_) => return reply(400, error_body(Value::Null, PARSE_ERROR, "Parse error", None)),
  };
  let Some(object) = message.as_object() else {
    let text = if message.is_array() {
      "Batch requests are not supported"
    } else {
      "Invalid request"
    };
    return reply(400, error_body(Value::Null, INVALID_REQUEST, text, None));
  };
  let Some(method) = object.get("method").and_then(Value::as_str) else {
    // A client's response or error: this server sends no requests to answer.
    return if object.contains_key("result") || object.contains_key("error") {
      Outcome::Accepted
    } else {
      reply(
        400,
        error_body(Value::Null, INVALID_REQUEST, "Invalid request", None),
      )
    };
  };
  let params = object.get("params").and_then(Value::as_object);
  let meta = params
    .and_then(|params| params.get("_meta"))
    .and_then(Value::as_object);
  let Some(id) = object.get("id").filter(|id| id.is_string() || id.is_number()) else {
    return if object.contains_key("id") {
      reply(
        400,
        error_body(Value::Null, INVALID_REQUEST, "Invalid request id", None),
      )
    } else {
      Outcome::Accepted
    };
  };
  let id = id.clone();
  match meta.and_then(|meta| meta.get(META_VERSION)) {
    Some(version) => route_modern(id, method, params, version, headers, ctx),
    None => route_legacy(id, method, params, headers, ctx),
  }
}

fn supported_versions() -> Value {
  json!(MODERN_VERSIONS
    .iter()
    .chain(LEGACY_VERSIONS)
    .collect::<Vec<_>>())
}

fn mismatch(id: Value, text: &str) -> Outcome {
  reply(
    400,
    error_body(id, HEADER_MISMATCH, &format!("Header mismatch: {text}"), None),
  )
}

fn route_modern(
  id: Value,
  method: &str,
  params: Option<&Map<String, Value>>,
  version: &Value,
  headers: &McpHeaders,
  ctx: &mut Context,
) -> Outcome {
  let meta = params
    .and_then(|params| params.get("_meta"))
    .and_then(Value::as_object);
  let Some(version) = version.as_str() else {
    return reply(
      400,
      error_body(id, INVALID_PARAMS, "protocolVersion must be a string", None),
    );
  };
  if !MODERN_VERSIONS.contains(&version) {
    return reply(
      400,
      error_body(
        id,
        UNSUPPORTED_VERSION,
        "Unsupported protocol version",
        Some(json!({ "supported": supported_versions(), "requested": version })),
      ),
    );
  }
  if headers.protocol_version.as_deref() != Some(version) {
    return mismatch(
      id,
      "MCP-Protocol-Version header does not match the request's protocolVersion",
    );
  }
  if headers.method.as_deref() != Some(method) {
    return mismatch(id, "Mcp-Method header does not match the request's method");
  }
  if !meta.is_some_and(|meta| meta.contains_key(META_CAPABILITIES)) {
    return reply(
      400,
      error_body(
        id,
        INVALID_PARAMS,
        "Missing io.modelcontextprotocol/clientCapabilities in _meta",
        None,
      ),
    );
  }
  if let Some(client) = client_info(meta.and_then(|meta| meta.get(META_CLIENT))) {
    (ctx.on_client)(client);
  }
  let answer = |result: Value| {
    reply(
      200,
      result_body(id.clone(), complete(result, ctx.server_version)),
    )
  };
  // 2026-07-28 removed ping; it stays a legacy method.
  match method {
    "server/discover" => answer(cacheable(json!({
      "supportedVersions": supported_versions(),
      "capabilities": capabilities(),
      "instructions": INSTRUCTIONS,
    }))),
    "tools/list" => answer(cacheable(json!({ "tools": ctx.tools }))),
    "tools/call" => {
      let name = params
        .and_then(|params| params.get("name"))
        .and_then(Value::as_str);
      let header = headers.name.as_deref().and_then(decode_header_value);
      match (name, header) {
        (Some(name), Some(header)) if name == header => call(id, name, params, true, ctx),
        (None, _) => reply(
          400,
          error_body(id, INVALID_PARAMS, "Missing tool name", None),
        ),
        _ => mismatch(id, "Mcp-Name header does not match the tool name"),
      }
    }
    _ => reply(
      404,
      error_body(id, METHOD_NOT_FOUND, "Method not found", None),
    ),
  }
}

fn route_legacy(
  id: Value,
  method: &str,
  params: Option<&Map<String, Value>>,
  headers: &McpHeaders,
  ctx: &mut Context,
) -> Outcome {
  if method == "initialize" {
    if let Some(client) = client_info(params.and_then(|params| params.get("clientInfo"))) {
      (ctx.on_client)(client);
    }
    let requested = params
      .and_then(|params| params.get("protocolVersion"))
      .and_then(Value::as_str);
    let version = LEGACY_VERSIONS
      .iter()
      .find(|version| Some(**version) == requested)
      .unwrap_or(&LEGACY_VERSIONS[0]);
    return reply(
      200,
      result_body(
        id,
        json!({
          "protocolVersion": version,
          "capabilities": capabilities(),
          "serverInfo": server_info(ctx.server_version),
          "instructions": INSTRUCTIONS,
        }),
      ),
    );
  }
  let version = headers
    .protocol_version
    .as_deref()
    .unwrap_or(HEADERLESS_VERSION);
  if MODERN_VERSIONS.contains(&version) {
    // A modern request must carry its version in _meta too.
    return reply(
      400,
      error_body(
        id,
        INVALID_PARAMS,
        "Missing io.modelcontextprotocol/protocolVersion in _meta",
        None,
      ),
    );
  }
  if !LEGACY_VERSIONS.contains(&version) {
    return reply(
      400,
      error_body(
        id,
        INVALID_REQUEST,
        "Unsupported protocol version",
        Some(json!({ "supported": supported_versions(), "requested": version })),
      ),
    );
  }
  match method {
    "tools/list" => reply(200, result_body(id, json!({ "tools": ctx.tools }))),
    "ping" => reply(200, result_body(id, json!({}))),
    "tools/call" => match params
      .and_then(|params| params.get("name"))
      .and_then(Value::as_str)
    {
      Some(name) => call(id, name, params, false, ctx),
      None => reply(
        200,
        error_body(id, INVALID_PARAMS, "Missing tool name", None),
      ),
    },
    _ => reply(
      200,
      error_body(id, METHOD_NOT_FOUND, "Method not found", None),
    ),
  }
}

fn call(
  id: Value,
  name: &str,
  params: Option<&Map<String, Value>>,
  modern: bool,
  ctx: &Context,
) -> Outcome {
  if !known_tool(ctx.tools, name) {
    return reply(
      200,
      error_body(id, INVALID_PARAMS, &format!("Unknown tool: {name}"), None),
    );
  }
  let arguments = params
    .and_then(|params| params.get("arguments"))
    .cloned()
    .unwrap_or_else(|| json!({}));
  // Answered here, so input that does not fit never waits for the webview.
  if let Some(notes) = ctx.notes.get(name) {
    let problems = inputs::problems(notes, &arguments);
    if !problems.is_empty() {
      return reply(
        200,
        tool_response(id, inputs::invalid_input(problems), modern, ctx.server_version),
      );
    }
  }
  Outcome::Call {
    id,
    name: name.to_string(),
    arguments,
    modern,
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn tools() -> Value {
    json!([{
      "name": "list_invoices",
      "inputSchema": {
        "type": "object",
        "properties": { "startDate": { "type": "string", "pattern": "^\\d{2}\\/\\d{2}\\/\\d{4}$" } },
      },
    }])
  }

  fn route_with(body: Value, headers: McpHeaders) -> (Outcome, Vec<ClientInfo>) {
    let (tools, notes) = inputs::split(tools());
    let mut clients = Vec::new();
    let mut on_client = |client| clients.push(client);
    let mut ctx = Context {
      tools: &tools,
      notes: &notes,
      server_version: "1.2.3",
      on_client: &mut on_client,
    };
    let outcome = route(body.to_string().as_bytes(), &headers, &mut ctx);
    (outcome, clients)
  }

  fn modern_headers(method: &str, name: Option<&str>) -> McpHeaders {
    McpHeaders {
      protocol_version: Some("2026-07-28".into()),
      method: Some(method.into()),
      name: name.map(Into::into),
    }
  }

  fn modern(method: &str, params: Value) -> Value {
    let mut params = params;
    params["_meta"] = json!({
      META_VERSION: "2026-07-28",
      META_CAPABILITIES: {},
      META_CLIENT: { "name": "Test", "version": "9" },
    });
    json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params })
  }

  fn reply_of(outcome: Outcome) -> (u16, Value) {
    match outcome {
      Outcome::Reply { status, body } => (status, body),
      other => panic!("expected a reply, got {other:?}"),
    }
  }

  #[test]
  fn initialize_negotiates_a_legacy_version() {
    let body = json!({
      "jsonrpc": "2.0", "id": 0, "method": "initialize",
      "params": { "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": { "name": "claude-ai", "version": "0.1" } },
    });
    let (outcome, clients) = route_with(body, McpHeaders::default());
    let (status, body) = reply_of(outcome);
    assert_eq!(status, 200);
    assert_eq!(body["result"]["protocolVersion"], "2025-06-18");
    assert_eq!(body["result"]["serverInfo"]["name"], "angaria");
    assert_eq!(body["result"]["capabilities"]["tools"]["listChanged"], false);
    assert!(body["result"].get("resultType").is_none());
    assert_eq!(clients[0].name, "claude-ai");
    // Agents learn the signing flow and the company argument up front.
    let instructions = body["result"]["instructions"].as_str().unwrap();
    for name in ["request_signing_sms", "sign_invoices", "list_companies"] {
      assert!(instructions.contains(name), "{name}");
    }
  }

  #[test]
  fn initialize_negotiates_supported_older_and_unknown_versions() {
    for (requested, answered) in [
      ("2025-11-25", "2025-11-25"),
      ("2024-11-05", "2024-11-05"),
      // A modern version through initialize: modern clients use server/discover.
      ("2026-07-28", LEGACY_VERSIONS[0]),
      ("2099-01-01", LEGACY_VERSIONS[0]),
    ] {
      let body = json!({ "jsonrpc": "2.0", "id": 0, "method": "initialize", "params": { "protocolVersion": requested } });
      let (status, body) = reply_of(route_with(body, McpHeaders::default()).0);
      assert_eq!(status, 200);
      assert_eq!(body["result"]["protocolVersion"], answered, "{requested}");
    }
  }

  #[test]
  fn legacy_tools_list_has_no_cache_fields() {
    let headers = McpHeaders {
      protocol_version: Some("2025-11-25".into()),
      ..McpHeaders::default()
    };
    let list = json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list" });
    let (_, body) = reply_of(route_with(list, headers).0);
    assert!(body["result"].get("ttlMs").is_none());
    assert!(body["result"].get("cacheScope").is_none());
  }

  #[test]
  fn notifications_and_client_responses_are_accepted() {
    let note = json!({ "jsonrpc": "2.0", "method": "notifications/initialized" });
    assert_eq!(route_with(note, McpHeaders::default()).0, Outcome::Accepted);
    let response = json!({ "jsonrpc": "2.0", "id": 4, "result": {} });
    assert_eq!(route_with(response, McpHeaders::default()).0, Outcome::Accepted);
  }

  #[test]
  fn legacy_tools_list_and_call() {
    let headers = || McpHeaders {
      protocol_version: Some("2025-06-18".into()),
      ..McpHeaders::default()
    };
    let list = json!({ "jsonrpc": "2.0", "id": "a", "method": "tools/list" });
    let (status, body) = reply_of(route_with(list, headers()).0);
    assert_eq!(status, 200);
    assert_eq!(body["id"], "a");
    assert_eq!(body["result"]["tools"], tools());

    let call = json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": { "name": "list_invoices", "arguments": { "a": 1 } } });
    assert_eq!(
      route_with(call, headers()).0,
      Outcome::Call {
        id: json!(2),
        name: "list_invoices".into(),
        arguments: json!({ "a": 1 }),
        modern: false
      }
    );
  }

  #[test]
  fn an_unknown_tool_or_method_is_a_json_rpc_error() {
    let call = json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": { "name": "sign_invoice" } });
    let (status, body) = reply_of(route_with(call, McpHeaders::default()).0);
    assert_eq!(status, 200);
    assert_eq!(body["error"]["code"], INVALID_PARAMS);

    let other = json!({ "jsonrpc": "2.0", "id": 3, "method": "resources/list" });
    let (status, body) = reply_of(route_with(other, McpHeaders::default()).0);
    assert_eq!(status, 200);
    assert_eq!(body["error"]["code"], METHOD_NOT_FOUND);
  }

  #[test]
  fn legacy_requests_with_an_unknown_version_header_are_refused() {
    let headers = McpHeaders {
      protocol_version: Some("1999-01-01".into()),
      ..McpHeaders::default()
    };
    let list = json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list" });
    assert_eq!(reply_of(route_with(list, headers).0).0, 400);
  }

  #[test]
  fn modern_discover_and_list_carry_result_type() {
    let (outcome, clients) = route_with(
      modern("server/discover", json!({})),
      modern_headers("server/discover", None),
    );
    let (status, body) = reply_of(outcome);
    assert_eq!(status, 200);
    assert_eq!(body["result"]["resultType"], "complete");
    assert_eq!(body["result"]["supportedVersions"][0], "2026-07-28");
    assert_eq!(body["result"]["ttlMs"], CACHE_TTL_MS);
    assert_eq!(body["result"]["cacheScope"], "private");
    assert_eq!(
      body["result"]["_meta"][META_SERVER]["version"],
      "1.2.3"
    );
    assert_eq!(clients, vec![ClientInfo { name: "Test".into(), version: "9".into() }]);

    let (_, body) = reply_of(
      route_with(
        modern("tools/list", json!({})),
        modern_headers("tools/list", None),
      )
      .0,
    );
    assert_eq!(body["result"]["tools"], tools());
    assert_eq!(body["result"]["resultType"], "complete");
    // CacheableResult, required on 2026-07-28 list results.
    assert_eq!(body["result"]["ttlMs"], CACHE_TTL_MS);
    assert_eq!(body["result"]["cacheScope"], "private");
  }

  #[test]
  fn modern_call_needs_matching_headers() {
    let call = modern("tools/call", json!({ "name": "list_invoices", "arguments": {} }));
    assert!(matches!(
      route_with(call.clone(), modern_headers("tools/call", Some("list_invoices"))).0,
      Outcome::Call { modern: true, .. }
    ));
    let encoded = format!(
      "=?base64?{}?=",
      base64::engine::general_purpose::STANDARD.encode("list_invoices")
    );
    assert!(matches!(
      route_with(call.clone(), modern_headers("tools/call", Some(&encoded))).0,
      Outcome::Call { .. }
    ));

    for headers in [
      modern_headers("tools/call", Some("create_invoice")),
      modern_headers("tools/call", None),
      modern_headers("tools/list", Some("list_invoices")),
      McpHeaders {
        protocol_version: None,
        method: Some("tools/call".into()),
        name: Some("list_invoices".into()),
      },
    ] {
      let (status, body) = reply_of(route_with(call.clone(), headers).0);
      assert_eq!(status, 400);
      assert_eq!(body["error"]["code"], HEADER_MISMATCH);
    }
  }

  #[test]
  fn modern_requests_name_the_supported_versions_when_refused() {
    let mut body = modern("tools/list", json!({}));
    body["params"]["_meta"][META_VERSION] = json!("2030-01-01");
    let headers = McpHeaders {
      protocol_version: Some("2030-01-01".into()),
      method: Some("tools/list".into()),
      name: None,
    };
    let (status, body) = reply_of(route_with(body, headers).0);
    assert_eq!(status, 400);
    assert_eq!(body["error"]["code"], UNSUPPORTED_VERSION);
    assert_eq!(body["error"]["data"]["requested"], "2030-01-01");
    assert_eq!(body["error"]["data"]["supported"], supported_versions());
  }

  #[test]
  fn modern_requests_need_client_capabilities_and_known_methods() {
    let mut body = modern("tools/list", json!({}));
    body["params"]["_meta"]
      .as_object_mut()
      .unwrap()
      .remove(META_CAPABILITIES);
    let (status, body) = reply_of(route_with(body, modern_headers("tools/list", None)).0);
    assert_eq!(status, 400);
    assert_eq!(body["error"]["code"], INVALID_PARAMS);

    let (status, body) = reply_of(
      route_with(
        modern("prompts/list", json!({})),
        modern_headers("prompts/list", None),
      )
      .0,
    );
    assert_eq!(status, 404);
    assert_eq!(body["error"]["code"], METHOD_NOT_FOUND);
  }

  #[test]
  fn malformed_bodies_are_refused() {
    let (tools, notes) = inputs::split(tools());
    let mut on_client = |_| {};
    let mut ctx = Context {
      tools: &tools,
      notes: &notes,
      server_version: "1",
      on_client: &mut on_client,
    };
    let (status, body) = reply_of(route(b"{nope", &McpHeaders::default(), &mut ctx));
    assert_eq!((status, &body["error"]["code"]), (400, &json!(PARSE_ERROR)));
    let (status, _) = reply_of(route(b"[]", &McpHeaders::default(), &mut ctx));
    assert_eq!(status, 400);
  }

  #[test]
  fn input_that_does_not_fit_is_answered_without_a_call() {
    let headers = || McpHeaders {
      protocol_version: Some("2025-06-18".into()),
      ..McpHeaders::default()
    };
    let call = json!({ "jsonrpc": "2.0", "id": 5, "method": "tools/call", "params": { "name": "list_invoices", "arguments": { "startDate": "2026-10-01" } } });
    let (status, body) = reply_of(route_with(call, headers()).0);
    assert_eq!(status, 200);
    assert_eq!(body["id"], 5);
    assert_eq!(body["result"]["isError"], true);
    let error: Value =
      serde_json::from_str(body["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
    assert_eq!(error["error"]["code"], "invalid-input");
    assert_eq!(error["error"]["fields"]["startDate"], "Beklenen biçimde değil.");

    let modern_call = modern(
      "tools/call",
      json!({ "name": "list_invoices", "arguments": { "startDate": 1 } }),
    );
    let (_, body) =
      reply_of(route_with(modern_call, modern_headers("tools/call", Some("list_invoices"))).0);
    assert_eq!(body["result"]["resultType"], "complete");
    assert_eq!(body["result"]["isError"], true);
  }

  #[test]
  fn tool_responses_follow_the_era() {
    let result = json!({ "content": [], "_meta": { "x": 1 } });
    let modern = tool_response(json!(1), result.clone(), true, "1.2.3");
    assert_eq!(modern["result"]["resultType"], "complete");
    assert_eq!(modern["result"]["_meta"][META_SERVER]["version"], "1.2.3");
    assert_eq!(modern["result"]["_meta"]["x"], 1);
    assert_eq!(tool_response(json!(1), result.clone(), false, "1.2.3")["result"], result);
  }

  #[test]
  fn ping_is_legacy_only() {
    let (status, body) = reply_of(
      route_with(modern("ping", json!({})), modern_headers("ping", None)).0,
    );
    assert_eq!(status, 404);
    assert_eq!(body["error"]["code"], METHOD_NOT_FOUND);
    let ping = json!({ "jsonrpc": "2.0", "id": 1, "method": "ping" });
    let (status, body) = reply_of(route_with(ping, McpHeaders::default()).0);
    assert_eq!(status, 200);
    assert_eq!(body["result"], json!({}));
  }
}
