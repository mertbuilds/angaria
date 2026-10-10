//! TOML configs (Codex, Grok Build), edited with toml_edit so comments and
//! the order of everything else stay. add-mcp re-serializes the whole file
//! with @iarna/toml instead.

use serde_json::{Map, Number, Value};
use toml_edit::{Array, DocumentMut, InlineTable, Item, Table};

use super::{malformed, unexpected};

fn parse(text: &str) -> Result<DocumentMut, String> {
  text.parse::<DocumentMut>().map_err(|_| malformed())
}

fn value_to_json(value: &toml_edit::Value) -> Value {
  match value {
    toml_edit::Value::String(text) => Value::String(text.value().clone()),
    toml_edit::Value::Integer(number) => Value::from(*number.value()),
    toml_edit::Value::Float(number) => Number::from_f64(*number.value())
      .map(Value::Number)
      .unwrap_or(Value::Null),
    toml_edit::Value::Boolean(flag) => Value::Bool(*flag.value()),
    toml_edit::Value::Datetime(time) => Value::String(time.value().to_string()),
    toml_edit::Value::Array(items) => Value::Array(items.iter().map(value_to_json).collect()),
    toml_edit::Value::InlineTable(table) => Value::Object(
      table
        .iter()
        .map(|(key, value)| (key.to_string(), value_to_json(value)))
        .collect(),
    ),
  }
}

fn item_to_json(item: &Item) -> Option<Value> {
  match item {
    Item::None => None,
    Item::Value(value) => Some(value_to_json(value)),
    Item::Table(table) => Some(Value::Object(
      table
        .iter()
        .filter_map(|(key, item)| Some((key.to_string(), item_to_json(item)?)))
        .collect::<Map<_, _>>(),
    )),
    Item::ArrayOfTables(tables) => Some(Value::Array(
      tables
        .iter()
        .map(|table| item_to_json(&Item::Table(table.clone())).unwrap_or(Value::Null))
        .collect(),
    )),
  }
}

/// The whole file as a value.
pub fn parse_value(text: &str) -> Result<Value, String> {
  Ok(item_to_json(parse(text)?.as_item()).unwrap_or_else(|| Value::Object(Map::new())))
}

fn json_to_value(value: &Value) -> Option<toml_edit::Value> {
  Some(match value {
    Value::Null => return None,
    Value::Bool(flag) => (*flag).into(),
    Value::Number(number) => match number.as_i64() {
      Some(integer) => integer.into(),
      None => number.as_f64()?.into(),
    },
    Value::String(text) => text.as_str().into(),
    Value::Array(items) => {
      toml_edit::Value::Array(items.iter().filter_map(json_to_value).collect::<Array>())
    }
    Value::Object(map) => {
      let mut table = InlineTable::new();
      for (key, value) in map {
        if let Some(value) = json_to_value(value) {
          table.insert(key, value);
        }
      }
      toml_edit::Value::InlineTable(table)
    }
  })
}

/// `entry` as its own `[servers.name]` table.
fn entry_table(entry: &Value) -> Table {
  let mut table = Table::new();
  if let Value::Object(map) = entry {
    for (key, value) in map {
      if let Some(value) = json_to_value(value) {
        table.insert(key, Item::Value(value));
      }
    }
  }
  table
}

/// The item at `path`, made (as an implicit table) when missing.
fn servers_at<'a>(document: &'a mut DocumentMut, path: &[&str]) -> Result<&'a mut Item, String> {
  let mut item = document.as_item_mut();
  for key in path {
    let table = item.as_table_like_mut().ok_or_else(unexpected)?;
    item = table.entry(key).or_insert_with(|| {
      let mut table = Table::new();
      table.set_implicit(true);
      Item::Table(table)
    });
  }
  Ok(item)
}

/// Sets `name` under `path` to `entry`. `None` when it already is exactly that.
pub fn upsert(
  text: &str,
  path: &[&str],
  name: &str,
  entry: &Value,
) -> Result<Option<String>, String> {
  let mut document = parse(text)?;
  let servers = servers_at(&mut document, path)?;
  let existing = servers.as_table_like().ok_or_else(unexpected)?.get(name);
  if existing.and_then(item_to_json).as_ref() == Some(entry) {
    return Ok(None);
  }
  let table = entry_table(entry);
  match servers {
    Item::Value(toml_edit::Value::InlineTable(inline)) => {
      inline.insert(
        name,
        toml_edit::Value::InlineTable(table.into_inline_table()),
      );
    }
    other => {
      other
        .as_table_like_mut()
        .ok_or_else(unexpected)?
        .insert(name, Item::Table(table));
    }
  }
  Ok(Some(document.to_string()))
}

/// Removes `name` under `path`. `None` when it was not there.
pub fn remove(text: &str, path: &[&str], name: &str) -> Result<Option<String>, String> {
  let mut document = parse(text)?;
  let mut current: &mut dyn toml_edit::TableLike = document.as_table_mut();
  for key in path {
    match current.get_mut(key) {
      Some(item) => current = item.as_table_like_mut().ok_or_else(unexpected)?,
      None => return Ok(None),
    }
  }
  if current.remove(name).is_none() {
    return Ok(None);
  }
  Ok(Some(document.to_string()))
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;

  const SERVERS: &[&str] = &["mcp_servers"];

  fn entry() -> Value {
    json!({ "command": "/A/angaria-mcp", "args": [] })
  }

  #[test]
  fn adds_a_table_and_keeps_the_rest() {
    let text = "# Codex settings\nmodel = \"gpt-5\" # pinned\n\n[mcp_servers.other]\ncommand = \"x\"\nargs = [\"-y\"]\n\n[profiles.fast]\nmodel = \"mini\"\n";
    let written = upsert(text, SERVERS, "angaria", &entry()).unwrap().unwrap();
    assert!(written.starts_with("# Codex settings\nmodel = \"gpt-5\" # pinned\n"));
    assert!(written.contains("[mcp_servers.angaria]\ncommand = \"/A/angaria-mcp\"\nargs = []\n"));
    let value = parse_value(&written).unwrap();
    assert_eq!(value["mcp_servers"]["angaria"], entry());
    assert_eq!(value["mcp_servers"]["other"]["args"], json!(["-y"]));
    assert_eq!(value["profiles"]["fast"]["model"], "mini");
    assert_eq!(
      upsert(&written, SERVERS, "angaria", &entry()).unwrap(),
      None
    );
  }

  #[test]
  fn replaces_an_old_entry_and_creates_files() {
    let text = "[mcp_servers.angaria]\ncommand = \"/old\"\nenv = { A = \"1\" }\n";
    let written = upsert(text, SERVERS, "angaria", &entry()).unwrap().unwrap();
    assert_eq!(
      parse_value(&written).unwrap()["mcp_servers"]["angaria"],
      entry()
    );
    let written = upsert("", SERVERS, "angaria", &entry()).unwrap().unwrap();
    assert_eq!(
      written,
      "[mcp_servers.angaria]\ncommand = \"/A/angaria-mcp\"\nargs = []\n"
    );
  }

  #[test]
  fn inline_server_tables_stay_inline() {
    let text = "mcp_servers = { other = { command = \"x\" } }\n";
    let written = upsert(text, SERVERS, "angaria", &entry()).unwrap().unwrap();
    assert!(written.starts_with("mcp_servers = {"));
    assert_eq!(
      parse_value(&written).unwrap()["mcp_servers"]["angaria"],
      entry()
    );
  }

  #[test]
  fn refuses_files_it_would_break() {
    assert!(upsert("model = ", SERVERS, "angaria", &entry()).is_err());
    assert!(upsert("mcp_servers = 3\n", SERVERS, "angaria", &entry()).is_err());
    assert!(remove("[[", SERVERS, "angaria").is_err());
  }

  #[test]
  fn removes_only_its_own_entry() {
    let text = "[mcp_servers.angaria]\ncommand = \"/A\"\n\n# other server\n[mcp_servers.other]\ncommand = \"x\"\n";
    let written = remove(text, SERVERS, "angaria").unwrap().unwrap();
    assert_eq!(
      written,
      "\n# other server\n[mcp_servers.other]\ncommand = \"x\"\n"
    );
    assert_eq!(remove(&written, SERVERS, "angaria").unwrap(), None);
    assert_eq!(remove("", SERVERS, "angaria").unwrap(), None);
  }
}
