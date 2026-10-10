//! YAML configs (goose). There is no format-keeping YAML editor in Rust, so
//! the entry is edited as lines inside the top-level block mapping, and the
//! result must parse to exactly the expected document. When it does not (a
//! flow mapping, tabs, anything unusual) the file is written again from the
//! parsed document, which drops its comments; add-mcp always does that.

use serde_json::Value as Json;
use serde_norway::{Mapping, Value};

use super::{malformed, unexpected};

fn parse(text: &str) -> Result<Mapping, String> {
  match serde_norway::from_str::<Value>(text).map_err(|_| malformed())? {
    Value::Null => Ok(Mapping::new()),
    Value::Mapping(mapping) => Ok(mapping),
    _ => Err(unexpected()),
  }
}

/// The whole file as a value.
pub fn parse_value(text: &str) -> Result<Json, String> {
  serde_json::to_value(parse(text)?).map_err(|_| unexpected())
}

/// The servers mapping under `key`; a missing or empty key is an empty one.
fn servers<'a>(document: &'a mut Mapping, key: &str) -> Result<&'a mut Mapping, String> {
  let value = document
    .entry(Value::String(key.into()))
    .or_insert(Value::Null);
  if value.is_null() {
    *value = Value::Mapping(Mapping::new());
  }
  value.as_mapping_mut().ok_or_else(unexpected)
}

fn leading_spaces(line: &str) -> usize {
  line.len() - line.trim_start_matches(' ').len()
}

fn is_content(line: &str) -> bool {
  let trimmed = line.trim();
  !trimmed.is_empty() && !trimmed.starts_with('#')
}

/// Whether `line` opens the block of mapping key `name` at `indent` spaces.
fn opens(line: &str, indent: usize, name: &str) -> bool {
  if leading_spaces(line) != indent {
    return false;
  }
  let rest = &line[indent..];
  [
    format!("{name}:"),
    format!("\"{name}\":"),
    format!("'{name}':"),
  ]
  .iter()
  .any(|start| rest.starts_with(start.as_str()))
}

/// Where the block mapping of top-level `key` is: the line after `key:` and
/// the end of its children. `None` when the key is missing; `Err` when its
/// value is written on the same line (flow style).
fn block_of(lines: &[&str], key: &str) -> Result<Option<(usize, usize)>, ()> {
  let Some(head) = lines.iter().position(|line| opens(line, 0, key)) else {
    return Ok(None);
  };
  let after = lines[head].trim_end()[key.len() + 1..].trim_start();
  if !after.is_empty() && !after.starts_with('#') {
    return Err(());
  }
  let mut end = head + 1;
  for (index, line) in lines.iter().enumerate().skip(head + 1) {
    if is_content(line) && !line.starts_with(' ') {
      break;
    }
    if is_content(line) {
      end = index + 1;
    }
  }
  Ok(Some((head + 1, end)))
}

/// `entry` as YAML lines under `name`, indented by `indent` spaces. Values
/// are written as JSON, which YAML reads as flow nodes.
fn render(name: &str, entry: &Json, indent: usize) -> String {
  let pad = " ".repeat(indent);
  let mut text = format!("{pad}{name}:\n");
  if let Json::Object(map) = entry {
    for (key, value) in map {
      text.push_str(&format!("{pad}{pad}{key}: {value}\n"));
    }
  }
  text
}

/// The text with `name` taken out of the top-level `key` block and, with
/// `entry`, written back in its place (or at the block's end).
fn edit_lines(text: &str, key: &str, name: &str, entry: Option<&Json>) -> Option<String> {
  if text.contains('\t') {
    return None;
  }
  let lines: Vec<&str> = text.split_inclusive('\n').collect();
  let Some((start, end)) = block_of(&lines, key).ok()? else {
    let entry = entry?;
    let mut out = text.to_string();
    if !out.is_empty() && !out.ends_with('\n') {
      out.push('\n');
    }
    out.push_str(&format!("{key}:\n{}", render(name, entry, 2)));
    return Some(out);
  };
  let indent = lines[start..end]
    .iter()
    .find(|line| is_content(line))
    .map(|line| leading_spaces(line))
    .unwrap_or(2);
  let (from, to) = match (start..end).find(|&index| opens(lines[index], indent, name)) {
    Some(from) => {
      let mut to = from + 1;
      for (index, line) in lines.iter().enumerate().take(end).skip(from + 1) {
        if is_content(line) && leading_spaces(line) <= indent {
          break;
        }
        if is_content(line) {
          to = index + 1;
        }
      }
      (from, to)
    }
    None => (end, end),
  };
  let mut out: String = lines[..from].concat();
  if !out.is_empty() && !out.ends_with('\n') {
    out.push('\n');
  }
  if let Some(entry) = entry {
    out.push_str(&render(name, entry, indent));
  }
  out.push_str(&lines[to..].concat());
  Some(out)
}

/// The edited text when it reads back as `expected`, else `expected` written out.
fn finish(edited: Option<String>, expected: &Mapping) -> Result<String, String> {
  if let Some(text) = edited {
    if parse(&text).ok().as_ref() == Some(expected) {
      return Ok(text);
    }
  }
  serde_norway::to_string(expected).map_err(|error| error.to_string())
}

/// Sets `name` under the top-level `key` to `entry`. `None` when it already is exactly that.
pub fn upsert(text: &str, key: &str, name: &str, entry: &Json) -> Result<Option<String>, String> {
  let mut expected = parse(text)?;
  let value = serde_norway::to_value(entry).map_err(|error| error.to_string())?;
  let servers = servers(&mut expected, key)?;
  if servers.get(name) == Some(&value) {
    return Ok(None);
  }
  servers.insert(Value::String(name.into()), value);
  finish(edit_lines(text, key, name, Some(entry)), &expected).map(Some)
}

/// Removes `name` under the top-level `key`. `None` when it was not there.
pub fn remove(text: &str, key: &str, name: &str) -> Result<Option<String>, String> {
  let mut expected = parse(text)?;
  let Some(servers) = expected.get_mut(key) else {
    return Ok(None);
  };
  let Some(servers) = servers.as_mapping_mut() else {
    return if servers.is_null() {
      Ok(None)
    } else {
      Err(unexpected())
    };
  };
  if servers.shift_remove(name).is_none() {
    return Ok(None);
  }
  finish(edit_lines(text, key, name, None), &expected).map(Some)
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;

  fn entry() -> Json {
    json!({
      "name": "angaria",
      "description": "",
      "cmd": "/Applications/Angaria.app/Contents/MacOS/angaria-mcp",
      "args": [],
      "enabled": true,
      "envs": {},
      "type": "stdio",
      "timeout": 300,
    })
  }

  const GOOSE: &str = "# goose settings\nGOOSE_PROVIDER: anthropic\nextensions:\n  developer:\n    enabled: true # built in\n    name: developer\n    type: builtin\n\n# keep this\nGOOSE_MODE: smart_approve\n";

  #[test]
  fn adds_inside_the_block_and_keeps_comments() {
    let written = upsert(GOOSE, "extensions", "angaria", &entry())
      .unwrap()
      .unwrap();
    assert!(written.contains("# goose settings\n"));
    assert!(written.contains("enabled: true # built in\n"));
    assert!(written.contains("# keep this\nGOOSE_MODE: smart_approve\n"));
    assert!(written.contains("  angaria:\n    name: \"angaria\"\n"));
    let value = parse_value(&written).unwrap();
    assert_eq!(value["extensions"]["angaria"], entry());
    assert_eq!(value["extensions"]["developer"]["type"], "builtin");
    assert_eq!(
      upsert(&written, "extensions", "angaria", &entry()).unwrap(),
      None
    );
  }

  #[test]
  fn replaces_an_old_entry_in_place() {
    let text =
      "extensions:\n  angaria:\n    cmd: /old\n    envs:\n      A: '1'\n  other:\n    cmd: x\n";
    let written = upsert(text, "extensions", "angaria", &entry())
      .unwrap()
      .unwrap();
    assert!(written.ends_with("  other:\n    cmd: x\n"));
    let value = parse_value(&written).unwrap();
    assert_eq!(value["extensions"]["angaria"], entry());
    assert_eq!(value["extensions"]["other"]["cmd"], "x");
  }

  #[test]
  fn creates_the_key_and_the_file() {
    let written = upsert("GOOSE_MODE: auto", "extensions", "angaria", &entry())
      .unwrap()
      .unwrap();
    assert!(written.starts_with("GOOSE_MODE: auto\nextensions:\n  angaria:\n"));
    assert_eq!(
      parse_value(&written).unwrap()["extensions"]["angaria"],
      entry()
    );
    let written = upsert("", "extensions", "angaria", &entry())
      .unwrap()
      .unwrap();
    assert_eq!(
      parse_value(&written).unwrap()["extensions"]["angaria"],
      entry()
    );
    let written = upsert("extensions:\n", "extensions", "angaria", &entry())
      .unwrap()
      .unwrap();
    assert_eq!(
      parse_value(&written).unwrap()["extensions"]["angaria"],
      entry()
    );
  }

  #[test]
  fn flow_style_is_written_out_again() {
    let text = "extensions: {other: {cmd: x}}\n";
    let written = upsert(text, "extensions", "angaria", &entry())
      .unwrap()
      .unwrap();
    let value = parse_value(&written).unwrap();
    assert_eq!(value["extensions"]["angaria"], entry());
    assert_eq!(value["extensions"]["other"]["cmd"], "x");
  }

  #[test]
  fn refuses_files_it_would_break() {
    assert!(upsert("extensions: [\n", "extensions", "angaria", &entry()).is_err());
    assert!(upsert("- a\n- b\n", "extensions", "angaria", &entry()).is_err());
    assert!(upsert("extensions: 3\n", "extensions", "angaria", &entry()).is_err());
    assert!(remove("a: [", "extensions", "angaria").is_err());
  }

  #[test]
  fn removes_only_its_own_entry() {
    let written = upsert(GOOSE, "extensions", "angaria", &entry())
      .unwrap()
      .unwrap();
    let removed = remove(&written, "extensions", "angaria").unwrap().unwrap();
    assert_eq!(removed, GOOSE);
    assert_eq!(remove(&removed, "extensions", "angaria").unwrap(), None);
    assert_eq!(remove("", "extensions", "angaria").unwrap(), None);
  }
}
