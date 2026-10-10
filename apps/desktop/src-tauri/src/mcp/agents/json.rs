//! JSON and JSONC configs, edited in place: comments, key order and
//! indentation outside the changed entry stay as they were (add-mcp does the
//! same with jsonc-parser's `modify`).

use jsonc_parser::cst::{CstInputValue, CstObject, CstRootNode};
use jsonc_parser::ParseOptions;
use serde_json::Value;

use super::{malformed, unexpected};

/// JSONC as the agents read it: comments and trailing commas, nothing looser.
fn options() -> ParseOptions {
  ParseOptions {
    allow_comments: true,
    allow_trailing_commas: true,
    allow_loose_object_property_names: false,
    allow_missing_commas: false,
    allow_single_quoted_strings: false,
    allow_hexadecimal_numbers: false,
    allow_unary_plus_numbers: false,
    allow_bare_decimal_point_numbers: false,
    allow_non_finite_numbers: false,
    allow_extended_string_escapes: false,
  }
}

fn parse(text: &str) -> Result<CstRootNode, String> {
  CstRootNode::parse(text, &options()).map_err(|_| malformed())
}

/// The root object; `None` for an empty or comment-only file.
fn root_object(root: &CstRootNode) -> Result<Option<CstObject>, String> {
  match root.value() {
    None => Ok(None),
    Some(value) => value.as_object().map(Some).ok_or_else(unexpected),
  }
}

/// The whole file as a value: `{}` when it is empty or holds only comments.
pub fn parse_value(text: &str) -> Result<Value, String> {
  let root = parse(text)?;
  Ok(match root_object(&root)? {
    Some(object) => object.to_serde_value().ok_or_else(malformed)?,
    None => Value::Object(Default::default()),
  })
}

fn input(value: &Value) -> CstInputValue {
  match value {
    Value::Null => CstInputValue::Null,
    Value::Bool(value) => CstInputValue::Bool(*value),
    Value::Number(number) => CstInputValue::Number(number.to_string()),
    Value::String(text) => CstInputValue::String(text.clone()),
    Value::Array(items) => CstInputValue::Array(items.iter().map(input).collect()),
    Value::Object(map) => CstInputValue::Object(
      map
        .iter()
        .map(|(key, value)| (key.clone(), input(value)))
        .collect(),
    ),
  }
}

/// The object at `path`, created when missing (a `null` counts as missing).
fn object_at(object: CstObject, path: &[&str]) -> Result<CstObject, String> {
  let mut current = object;
  for key in path {
    let next = match current.get(key) {
      Some(prop) => match prop.value() {
        Some(value) if value.to_serde_value() == Some(Value::Null) => {
          current.object_value_or_set(key)
        }
        Some(value) => value.as_object().ok_or_else(unexpected)?,
        None => current.object_value_or_set(key),
      },
      None => current.object_value_or_set(key),
    };
    current = next;
  }
  Ok(current)
}

/// Sets `name` under `path` to `entry`. `None` when it already is exactly that.
/// `strict` writes plain JSON for agents that refuse comments.
pub fn upsert(
  text: &str,
  path: &[&str],
  name: &str,
  entry: &Value,
  strict: bool,
) -> Result<Option<String>, String> {
  let root = parse(text)?;
  let object = match root_object(&root)? {
    Some(object) => object,
    None => root.object_value_or_set(),
  };
  let servers = object_at(object, path)?;
  match servers.get(name) {
    Some(prop) if prop.to_serde_value().as_ref() == Some(entry) => return Ok(None),
    Some(prop) => prop.set_value(input(entry)),
    None => {
      servers.append(name, input(entry));
    }
  }
  Ok(Some(finish(root.to_string(), strict)?))
}

/// Removes `name` under `path`. `None` when it was not there.
pub fn remove(
  text: &str,
  path: &[&str],
  name: &str,
  strict: bool,
) -> Result<Option<String>, String> {
  let root = parse(text)?;
  let Some(mut current) = root_object(&root)? else {
    return Ok(None);
  };
  for key in path {
    match current.get(key).and_then(|prop| prop.value()) {
      Some(value) => match value.as_object() {
        Some(object) => current = object,
        None if value.to_serde_value() == Some(Value::Null) => return Ok(None),
        None => return Err(unexpected()),
      },
      None => return Ok(None),
    }
  }
  let Some(prop) = current.get(name) else {
    return Ok(None);
  };
  prop.remove();
  Ok(Some(finish(root.to_string(), strict)?))
}

/// GitHub Copilot CLI rejects JSONC: a file that had comments goes back as JSON.
fn finish(text: String, strict: bool) -> Result<String, String> {
  if !strict || serde_json::from_str::<Value>(&text).is_ok() {
    return Ok(text);
  }
  let value = parse_value(&text)?;
  let mut json = serde_json::to_string_pretty(&value).map_err(|error| error.to_string())?;
  json.push('\n');
  Ok(json)
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;

  const SERVERS: &[&str] = &["mcpServers"];

  fn entry() -> Value {
    json!({ "command": "/A/angaria-mcp", "args": [] })
  }

  #[test]
  fn adds_to_a_jsonc_file_and_keeps_its_comments() {
    let text = "{\n  // my servers\n  \"mcpServers\": {\n    \"other\": { \"command\": \"x\" }, // keep\n  },\n  \"theme\": \"dark\"\n}\n";
    let written = upsert(text, SERVERS, "angaria", &entry(), false)
      .unwrap()
      .unwrap();
    assert!(written.contains("// my servers"));
    assert!(written.contains("// keep"));
    assert!(written.ends_with("}\n"));
    let value = parse_value(&written).unwrap();
    assert_eq!(value["mcpServers"]["angaria"], entry());
    assert_eq!(value["mcpServers"]["other"]["command"], "x");
    assert_eq!(value["theme"], "dark");
    assert_eq!(
      upsert(&written, SERVERS, "angaria", &entry(), false).unwrap(),
      None
    );
  }

  #[test]
  fn replaces_an_old_entry_whole() {
    let text = r#"{"mcpServers":{"angaria":{"command":"/old","env":{"A":"1"}}}}"#;
    let written = upsert(text, SERVERS, "angaria", &entry(), false)
      .unwrap()
      .unwrap();
    assert_eq!(
      parse_value(&written).unwrap()["mcpServers"]["angaria"],
      entry()
    );
  }

  #[test]
  fn creates_nested_keys_and_empty_files() {
    let written = upsert("", &["mcp", "servers"], "angaria", &entry(), false)
      .unwrap()
      .unwrap();
    assert_eq!(
      parse_value(&written).unwrap()["mcp"]["servers"]["angaria"],
      entry()
    );
    let written = upsert("// only a comment\n", SERVERS, "angaria", &entry(), false)
      .unwrap()
      .unwrap();
    assert!(written.contains("// only a comment"));
    assert_eq!(
      parse_value(&written).unwrap()["mcpServers"]["angaria"],
      entry()
    );
    let written = upsert(
      r#"{"mcpServers":null}"#,
      SERVERS,
      "angaria",
      &entry(),
      false,
    )
    .unwrap()
    .unwrap();
    assert_eq!(
      parse_value(&written).unwrap()["mcpServers"]["angaria"],
      entry()
    );
  }

  #[test]
  fn refuses_files_it_would_break() {
    assert!(upsert("{ nope", SERVERS, "angaria", &entry(), false).is_err());
    assert!(upsert("{\"a\": 1 \"b\": 2}", SERVERS, "angaria", &entry(), false).is_err());
    assert!(upsert("[]", SERVERS, "angaria", &entry(), false).is_err());
    assert!(upsert(r#"{"mcpServers":[]}"#, SERVERS, "angaria", &entry(), false).is_err());
    assert!(remove("{ nope", SERVERS, "angaria", false).is_err());
  }

  #[test]
  fn removes_only_its_own_entry() {
    let text = "{\n  \"mcpServers\": {\n    // ours\n    \"angaria\": { \"command\": \"/A\" },\n    \"other\": { \"command\": \"x\" }\n  }\n}\n";
    let written = remove(text, SERVERS, "angaria", false).unwrap().unwrap();
    let value = parse_value(&written).unwrap();
    assert_eq!(value["mcpServers"], json!({ "other": { "command": "x" } }));
    assert_eq!(remove(&written, SERVERS, "angaria", false).unwrap(), None);
    assert_eq!(remove("", SERVERS, "angaria", false).unwrap(), None);
    assert_eq!(remove("{}", SERVERS, "angaria", false).unwrap(), None);
  }

  #[test]
  fn strict_files_lose_their_comments() {
    let text = "{\n  // comment\n  \"mcpServers\": {}\n}\n";
    let written = upsert(text, SERVERS, "angaria", &entry(), true)
      .unwrap()
      .unwrap();
    let value: Value = serde_json::from_str(&written).unwrap();
    assert_eq!(value["mcpServers"]["angaria"], entry());
  }
}
