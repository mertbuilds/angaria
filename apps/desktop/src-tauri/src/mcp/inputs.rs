//! What the server knows of each tool beyond tools/list, and the input check
//! that runs before a call goes to the webview, so a call that does not fit
//! its schema is answered at once, whatever the webview is doing. The app
//! sends both in its tool list (`mcp_start`): a tool may carry `x-angaria`,
//! which the server keeps and never lists, with `check` (where the user sees
//! whether a write went through) and `patterns` (the Turkish message for each
//! pattern in its input schema). The messages match the app's
//! (`inputIssue` in src/lib/mcp-tool-kit.ts), which checks the rest.

use std::collections::{BTreeMap, HashMap};

use regex::Regex;
use serde_json::{json, Value};

const PRIVATE_KEY: &str = "x-angaria";
/// The message of every input that does not fit, as the app words it.
pub const INVALID_INPUT: &str = "Girdi aracın şemasına uymuyor.";
const ROOT_PATH: &str = "(girdi)";

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ToolNotes {
  /// annotations.readOnlyHint: running it again changes nothing.
  pub read_only: bool,
  /// Where to see whether a write went through, as "<check> kontrol et" reads it.
  pub check: Option<String>,
  /// Turkish messages by pattern.
  pub patterns: HashMap<String, String>,
  pub input_schema: Value,
}

pub type Notes = HashMap<String, ToolNotes>;

/// The tools as tools/list shows them (without `x-angaria`) and each one's notes by name.
pub fn split(tools: Value) -> (Value, Notes) {
  let mut notes = HashMap::new();
  let Value::Array(list) = tools else {
    return (tools, notes);
  };
  let listed = list
    .into_iter()
    .map(|mut tool| {
      let private = tool
        .as_object_mut()
        .and_then(|object| object.remove(PRIVATE_KEY))
        .unwrap_or(Value::Null);
      if let Some(name) = tool["name"].as_str() {
        let patterns = private["patterns"]
          .as_object()
          .map(|patterns| {
            patterns
              .iter()
              .filter_map(|(pattern, message)| Some((pattern.clone(), message.as_str()?.to_string())))
              .collect()
          })
          .unwrap_or_default();
        notes.insert(
          name.to_string(),
          ToolNotes {
            read_only: tool["annotations"]["readOnlyHint"] == true,
            check: private["check"].as_str().map(String::from),
            patterns,
            input_schema: tool["inputSchema"].clone(),
          },
        );
      }
      tool
    })
    .collect();
  (Value::Array(listed), notes)
}

/// What is wrong with `arguments`, in Turkish by path ("items.0.unitPrice"),
/// the first problem of each; empty when they fit the tool's input schema.
pub fn problems(notes: &ToolNotes, arguments: &Value) -> BTreeMap<String, String> {
  let mut found = BTreeMap::new();
  check(
    &notes.input_schema,
    arguments,
    &mut Vec::new(),
    &notes.patterns,
    &mut found,
  );
  found
}

/// The tool result for arguments with `problems`, shaped like the app's.
pub fn invalid_input(problems: BTreeMap<String, String>) -> Value {
  let error = json!({ "error": { "message": INVALID_INPUT, "code": "invalid-input", "fields": problems } });
  json!({
    "content": [{ "type": "text", "text": error.to_string() }],
    "isError": true,
  })
}

fn note(found: &mut BTreeMap<String, String>, path: &[String], message: String) {
  let key = if path.is_empty() {
    ROOT_PATH.to_string()
  } else {
    path.join(".")
  };
  found.entry(key).or_insert(message);
}

fn number_text(value: &Value) -> String {
  value.to_string()
}

fn same(a: &Value, b: &Value) -> bool {
  match (a.as_f64(), b.as_f64()) {
    (Some(x), Some(y)) => x == y,
    _ => a == b,
  }
}

fn has_type(kind: &str, value: &Value) -> bool {
  match kind {
    "string" => value.is_string(),
    "number" => value.is_number(),
    "integer" => value.as_f64().is_some_and(|number| number.fract() == 0.0),
    "boolean" => value.is_boolean(),
    "array" => value.is_array(),
    "object" => value.is_object(),
    "null" => value.is_null(),
    _ => true,
  }
}

fn type_message(kind: &str) -> String {
  match kind {
    "string" => "Metin olmalı.",
    "number" => "Sayı olmalı.",
    "integer" => "Tam sayı olmalı.",
    "boolean" => "true ya da false olmalı.",
    "array" => "Liste olmalı.",
    "object" => "Nesne olmalı.",
    _ => "Beklenen türde değil.",
  }
  .to_string()
}

fn choices_text(options: &[Value]) -> String {
  options
    .iter()
    .map(|option| match option {
      Value::String(text) => text.clone(),
      other => other.to_string(),
    })
    .collect::<Vec<_>>()
    .join(", ")
}

/// Whether `value` fits `schema`, noting the first problem of each path.
fn check(
  schema: &Value,
  value: &Value,
  path: &mut Vec<String>,
  patterns: &HashMap<String, String>,
  found: &mut BTreeMap<String, String>,
) -> bool {
  let Some(schema) = schema.as_object() else {
    return true;
  };
  if let Some(branches) = schema.get("anyOf").and_then(Value::as_array) {
    if branches
      .iter()
      .any(|branch| check(branch, value, path, patterns, &mut BTreeMap::new()))
    {
      return true;
    }
    // A nullable field: the problem is the one of the value's own branch.
    if let Some(branch) = branches
      .iter()
      .find(|branch| branch["type"] != "null")
      .or(branches.first())
    {
      check(branch, value, path, patterns, found);
    }
    return false;
  }
  // One type, or several (["string", "null"] for a nullable field).
  let kinds: Vec<&str> = match schema.get("type") {
    Some(Value::String(kind)) => vec![kind.as_str()],
    Some(Value::Array(kinds)) => kinds.iter().filter_map(Value::as_str).collect(),
    _ => Vec::new(),
  };
  if !kinds.is_empty() && !kinds.iter().any(|kind| has_type(kind, value)) {
    let kind = kinds.iter().find(|kind| **kind != "null").unwrap_or(&kinds[0]);
    note(found, path, type_message(kind));
    return false;
  }
  if let Some(expected) = schema.get("const") {
    if !same(expected, value) {
      note(found, path, format!("Şunlardan biri olmalı: {}.", choices_text(std::slice::from_ref(expected))));
      return false;
    }
  }
  if let Some(options) = schema.get("enum").and_then(Value::as_array) {
    if !options.iter().any(|option| same(option, value)) {
      note(found, path, format!("Şunlardan biri olmalı: {}.", choices_text(options)));
      return false;
    }
  }
  let before = found.len();
  match value {
    Value::String(text) => check_string(schema, text, path, patterns, found),
    Value::Number(_) => check_number(schema, value, path, found),
    Value::Array(items) => check_array(schema, items, path, patterns, found),
    Value::Object(object) => {
      let required = schema.get("required").and_then(Value::as_array);
      for key in required.into_iter().flatten().filter_map(Value::as_str) {
        if !object.contains_key(key) {
          path.push(key.to_string());
          note(found, path, "Bu alan gerekli.".into());
          path.pop();
        }
      }
      if let Some(properties) = schema.get("properties").and_then(Value::as_object) {
        for (key, property) in properties {
          if let Some(field) = object.get(key) {
            path.push(key.clone());
            check(property, field, path, patterns, found);
            path.pop();
          }
        }
      }
    }
    _ => {}
  }
  found.len() == before
}

fn check_string(
  schema: &serde_json::Map<String, Value>,
  text: &str,
  path: &[String],
  patterns: &HashMap<String, String>,
  found: &mut BTreeMap<String, String>,
) {
  let length = text.chars().count() as u64;
  if let Some(min) = schema.get("minLength").and_then(Value::as_u64) {
    if length < min {
      let message = if min == 1 {
        "Boş olamaz.".to_string()
      } else {
        format!("En az {min} karakter olmalı.")
      };
      return note(found, path, message);
    }
  }
  if let Some(max) = schema.get("maxLength").and_then(Value::as_u64) {
    if length > max {
      return note(found, path, format!("En çok {max} karakter olabilir."));
    }
  }
  if let Some(pattern) = schema.get("pattern").and_then(Value::as_str) {
    // A pattern this engine cannot read is left to the app.
    if Regex::new(pattern).is_ok_and(|regex| !regex.is_match(text)) {
      let message = patterns
        .get(pattern)
        .cloned()
        .unwrap_or_else(|| "Beklenen biçimde değil.".to_string());
      note(found, path, message);
    }
  }
}

fn check_number(
  schema: &serde_json::Map<String, Value>,
  value: &Value,
  path: &[String],
  found: &mut BTreeMap<String, String>,
) {
  let Some(number) = value.as_f64() else {
    return;
  };
  let bound = |key: &str| schema.get(key).filter(|bound| bound.is_number());
  let message = if let Some(min) = bound("minimum").filter(|min| number < min.as_f64().unwrap()) {
    format!("{} ya da daha büyük olmalı.", number_text(min))
  } else if let Some(min) = bound("exclusiveMinimum").filter(|min| number <= min.as_f64().unwrap()) {
    format!("{} değerinden büyük olmalı.", number_text(min))
  } else if let Some(max) = bound("maximum").filter(|max| number > max.as_f64().unwrap()) {
    format!("{} ya da daha küçük olmalı.", number_text(max))
  } else if let Some(max) = bound("exclusiveMaximum").filter(|max| number >= max.as_f64().unwrap()) {
    format!("{} değerinden küçük olmalı.", number_text(max))
  } else {
    return;
  };
  note(found, path, message);
}

fn check_array(
  schema: &serde_json::Map<String, Value>,
  items: &[Value],
  path: &mut Vec<String>,
  patterns: &HashMap<String, String>,
  found: &mut BTreeMap<String, String>,
) {
  let count = items.len() as u64;
  if let Some(min) = schema.get("minItems").and_then(Value::as_u64) {
    if count < min {
      return note(found, path, format!("En az {min} öğe olmalı."));
    }
  }
  if let Some(max) = schema.get("maxItems").and_then(Value::as_u64) {
    if count > max {
      return note(found, path, format!("En çok {max} öğe olabilir."));
    }
  }
  if let Some(item_schema) = schema.get("items") {
    for (index, item) in items.iter().enumerate() {
      path.push(index.to_string());
      check(item_schema, item, path, patterns, found);
      path.pop();
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn notes_of(tool: Value) -> ToolNotes {
    let (_, notes) = split(json!([tool]));
    notes.into_values().next().unwrap()
  }

  fn invoice_tool() -> Value {
    json!({
      "name": "create_invoice",
      "annotations": { "destructiveHint": false },
      "inputSchema": {
        "type": "object",
        "properties": {
          "currency": { "type": "string", "pattern": "^[A-Za-z]{3}$" },
          "date": { "type": "string", "pattern": "^\\d{2}\\/\\d{2}\\/\\d{4}$" },
          "dueDays": { "type": "integer", "minimum": 0, "maximum": 365 },
          "invoiceType": { "type": "string", "enum": ["SATIS", "ISTISNA"] },
          "items": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "properties": {
                "name": { "type": "string", "minLength": 1 },
                "quantity": { "type": "number", "exclusiveMinimum": 0 },
                "VATRate": { "type": "number", "enum": [0, 1, 10, 20] },
              },
              "required": ["name", "quantity"],
            },
          },
          "pdfLanguage": { "anyOf": [{ "type": "string", "enum": ["tr", "en"] }, { "type": "null" }] },
          "note": { "type": ["string", "null"] },
        },
        "required": ["items"],
      },
      "x-angaria": {
        "check": "list_invoices ile",
        "patterns": { "^\\d{2}\\/\\d{2}\\/\\d{4}$": "Tarihi GG/AA/YYYY biçiminde yaz." },
      },
    })
  }

  #[test]
  fn split_keeps_the_notes_and_lists_the_rest() {
    let (listed, notes) = split(json!([
      invoice_tool(),
      { "name": "list_invoices", "annotations": { "readOnlyHint": true }, "inputSchema": { "type": "object" } },
    ]));
    assert!(listed[0].get(PRIVATE_KEY).is_none());
    assert_eq!(listed[0]["name"], "create_invoice");
    let create = &notes["create_invoice"];
    assert!(!create.read_only);
    assert_eq!(create.check.as_deref(), Some("list_invoices ile"));
    assert_eq!(create.patterns.len(), 1);
    assert!(notes["list_invoices"].read_only);
    assert_eq!(notes["list_invoices"].check, None);
  }

  #[test]
  fn input_that_fits_has_no_problems() {
    let notes = notes_of(invoice_tool());
    let input = json!({
      "currency": "usd",
      "date": "01/10/2026",
      "dueDays": 14,
      "items": [{ "name": "Danışmanlık", "quantity": 1.5, "VATRate": 20.0 }],
      "pdfLanguage": null,
      "note": null,
      "company": "anything the schema does not name",
    });
    assert!(problems(&notes, &input).is_empty());
  }

  #[test]
  fn problems_are_turkish_by_path() {
    let notes = notes_of(invoice_tool());
    let found = problems(
      &notes,
      &json!({
        "currency": "dollars",
        "date": "2026-10-01",
        "dueDays": 1.5,
        "invoiceType": "IHRACAT",
        "items": [{ "name": "", "quantity": 0, "VATRate": 18 }, { "quantity": "2" }],
        "pdfLanguage": "de",
        "note": 5,
      }),
    );
    let expected: BTreeMap<String, String> = [
      ("currency", "Beklenen biçimde değil."),
      ("date", "Tarihi GG/AA/YYYY biçiminde yaz."),
      ("dueDays", "Tam sayı olmalı."),
      ("invoiceType", "Şunlardan biri olmalı: SATIS, ISTISNA."),
      ("items.0.name", "Boş olamaz."),
      ("items.0.quantity", "0 değerinden büyük olmalı."),
      ("items.0.VATRate", "Şunlardan biri olmalı: 0, 1, 10, 20."),
      ("items.1.name", "Bu alan gerekli."),
      ("items.1.quantity", "Sayı olmalı."),
      ("note", "Metin olmalı."),
      ("pdfLanguage", "Şunlardan biri olmalı: tr, en."),
    ]
    .into_iter()
    .map(|(path, message)| (path.to_string(), message.to_string()))
    .collect();
    assert_eq!(found, expected);
  }

  #[test]
  fn missing_and_wrong_shapes_are_named() {
    let notes = notes_of(invoice_tool());
    assert_eq!(
      problems(&notes, &json!({})).get("items").map(String::as_str),
      Some("Bu alan gerekli.")
    );
    assert_eq!(
      problems(&notes, &json!({ "items": [] })).get("items").map(String::as_str),
      Some("En az 1 öğe olmalı.")
    );
    assert_eq!(
      problems(&notes, &json!({ "items": [], "dueDays": 400 })).get("dueDays").map(String::as_str),
      Some("365 ya da daha küçük olmalı.")
    );
    assert_eq!(
      problems(&notes, &json!("text")).get(ROOT_PATH).map(String::as_str),
      Some("Nesne olmalı.")
    );
  }

  #[test]
  fn the_result_is_a_tool_error_like_the_apps() {
    let result = invalid_input(BTreeMap::from([("date".to_string(), "Bu alan gerekli.".to_string())]));
    assert_eq!(result["isError"], true);
    let error: Value = serde_json::from_str(result["content"][0]["text"].as_str().unwrap()).unwrap();
    assert_eq!(error["error"]["message"], INVALID_INPUT);
    assert_eq!(error["error"]["code"], "invalid-input");
    assert_eq!(error["error"]["fields"]["date"], "Bu alan gerekli.");
  }
}
