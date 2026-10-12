//! The menu bar icon (docs/adr/0012-mcp-in-the-background.md): MCP's state
//! and switches, the agents' last calls, the window, Girişte başlat and Çık.
//! The menu is rebuilt from `TrayView` whenever any of it changes, and its
//! times again when the pointer reaches the icon.

use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Deserialize;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_autostart::ManagerExt;

use crate::background;
use crate::mcp::files::Settings;
use crate::mcp::{self, McpState};

/// The MCP page's label for the switch (src/pages/mcp-agent-sections.tsx).
pub const ACTIONS_LABEL: &str = "Ajanlar onaylayabilir ve silebilir";
/// How many of the agents' calls the menu lists.
pub const ACTIVITY_SIZE: usize = 5;
/// A call's line stops here, with an ellipsis.
const LABEL_MAX: usize = 72;

const ICON: &[u8] = include_bytes!("../icons/tray/tray-template.png");

/// One of the agents' calls as the webview logged it (src/lib/menu-bar.ts).
#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TrayActivity {
  /// The tool's Turkish title
  pub title: String,
  pub company: Option<String>,
  /// ms since the epoch
  pub at: i64,
  pub ok: bool,
  pub result: String,
}

/// What the menu shows.
pub struct TrayView<'a> {
  pub settings: Option<&'a Settings>,
  /// The port the server listens on.
  pub port: Option<u16>,
  /// The last start failed.
  pub failed: bool,
  pub activity: &'a [TrayActivity],
  pub launch_at_login: bool,
  pub now: i64,
}

#[derive(Debug, PartialEq)]
pub enum Entry {
  Item {
    id: &'static str,
    text: String,
    enabled: bool,
  },
  Check {
    id: &'static str,
    text: String,
    checked: bool,
  },
  Separator,
  Submenu {
    text: String,
    entries: Vec<Entry>,
  },
}

fn item(id: &'static str, text: impl Into<String>) -> Entry {
  Entry::Item {
    id,
    text: text.into(),
    enabled: true,
  }
}

fn check(id: &'static str, text: impl Into<String>, checked: bool) -> Entry {
  Entry::Check {
    id,
    text: text.into(),
    checked,
  }
}

pub fn status_line(view: &TrayView) -> String {
  let enabled = view.settings.is_some_and(|settings| settings.enabled);
  match (enabled, view.port) {
    (false, _) => "MCP kapalı".into(),
    (true, Some(port)) => format!("MCP açık, 127.0.0.1:{port}"),
    (true, None) if view.failed => "MCP başlatılamadı, Angaria’yı aç".into(),
    (true, None) => "MCP başlatılıyor…".into(),
  }
}

/// "az önce", "5 dakika önce", "3 saat önce", "dün", "4 gün önce".
pub fn relative_time(now: i64, at: i64) -> String {
  let minutes = (now - at).max(0) / 60_000;
  match minutes {
    0 => "az önce".into(),
    1..=59 => format!("{minutes} dakika önce"),
    60..=1439 => format!("{} saat önce", minutes / 60),
    1440..=2879 => "dün".into(),
    _ => format!("{} gün önce", minutes / 1440),
  }
}

fn shorten(text: &str) -> String {
  if text.chars().count() <= LABEL_MAX {
    return text.to_string();
  }
  let cut: String = text.chars().take(LABEL_MAX - 1).collect();
  format!("{}…", cut.trim_end())
}

/// "Taslak oluştur · Acme · 5 dakika önce · Taslak oluşturuldu".
pub fn activity_label(entry: &TrayActivity, now: i64) -> String {
  let mut parts = vec![entry.title.clone()];
  if let Some(company) = entry.company.as_deref().filter(|company| !company.is_empty()) {
    parts.push(company.to_string());
  }
  parts.push(relative_time(now, entry.at));
  let result = entry.result.lines().next().unwrap_or_default().trim();
  if !entry.ok {
    parts.push(format!("Hata: {result}"));
  } else if !result.is_empty() {
    parts.push(result.to_string());
  }
  shorten(&parts.join(" · "))
}

const ACTIVITY_IDS: [&str; ACTIVITY_SIZE] =
  ["activity-0", "activity-1", "activity-2", "activity-3", "activity-4"];

pub fn menu_entries(view: &TrayView) -> Vec<Entry> {
  let settings = view.settings.cloned().unwrap_or_default();
  let mut activity: Vec<Entry> = view
    .activity
    .iter()
    .take(ACTIVITY_SIZE)
    .zip(ACTIVITY_IDS)
    .map(|(entry, id)| item(id, activity_label(entry, view.now)))
    .collect();
  if activity.is_empty() {
    activity.push(Entry::Item {
      id: "activity-none",
      text: "Henüz işlem yok".into(),
      enabled: false,
    });
  }
  activity.push(Entry::Separator);
  activity.push(item("activity-all", "Tümünü gör"));
  vec![
    Entry::Item {
      id: "mcp-status",
      text: status_line(view),
      enabled: false,
    },
    check("mcp-enabled", "MCP", settings.enabled),
    check("mcp-actions", ACTIONS_LABEL, settings.allow_actions),
    Entry::Submenu {
      text: "Son ajan işlemleri".into(),
      entries: activity,
    },
    Entry::Separator,
    item("open", "Angaria’yı aç"),
    item("new-invoice", "Yeni fatura"),
    Entry::Separator,
    check("launch-at-login", "Girişte başlat", view.launch_at_login),
    // Ayarlar › Görünüm shows it again; Finder or Spotlight opens the window.
    item("hide-icon", "Menü çubuğundan gizle"),
    Entry::Separator,
    item("quit", "Çık"),
  ]
}

type Built = Box<dyn IsMenuItem<Wry>>;

fn build_entries(app: &AppHandle, entries: &[Entry]) -> tauri::Result<Vec<Built>> {
  entries
    .iter()
    .map(|entry| -> tauri::Result<Built> {
      Ok(match entry {
        Entry::Item { id, text, enabled } => {
          Box::new(MenuItem::with_id(app, *id, text, *enabled, None::<&str>)?)
        }
        Entry::Check { id, text, checked } => Box::new(CheckMenuItem::with_id(
          app,
          *id,
          text,
          true,
          *checked,
          None::<&str>,
        )?),
        Entry::Separator => Box::new(PredefinedMenuItem::separator(app)?),
        Entry::Submenu { text, entries } => {
          let items = build_entries(app, entries)?;
          let refs: Vec<&dyn IsMenuItem<Wry>> = items.iter().map(|item| item.as_ref()).collect();
          Box::new(Submenu::with_items(app, text, true, &refs)?)
        }
      })
    })
    .collect()
}

/// The icon and the calls it lists.
#[derive(Default)]
pub struct Tray {
  icon: Mutex<Option<TrayIcon>>,
  activity: Mutex<Vec<TrayActivity>>,
}

fn now_ms() -> i64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_or(0, |elapsed| elapsed.as_millis() as i64)
}

fn launch_at_login(app: &AppHandle) -> bool {
  app.autolaunch().is_enabled().unwrap_or(false)
}

/// Rebuilds the menu and shows or hides the icon per Menü çubuğunda göster.
pub fn refresh(app: &AppHandle) {
  let (Some(tray), Some(mcp)) = (app.try_state::<Tray>(), app.try_state::<McpState>()) else {
    return;
  };
  let Some(icon) = tray.icon.lock().unwrap().clone() else {
    return;
  };
  let settings = mcp.settings();
  let (port, failed) = mcp.run_state();
  let activity = tray.activity.lock().unwrap().clone();
  let view = TrayView {
    settings: settings.as_ref(),
    port,
    failed,
    activity: &activity,
    launch_at_login: launch_at_login(app),
    now: now_ms(),
  };
  let entries = menu_entries(&view);
  let menu = build_entries(app, &entries).and_then(|items| {
    let refs: Vec<&dyn IsMenuItem<Wry>> = items.iter().map(|item| item.as_ref()).collect();
    Menu::with_items(app, &refs)
  });
  match menu {
    Ok(menu) => {
      let _ = icon.set_menu(Some(menu));
    }
    Err(error) => log::error!("could not build the menu bar menu: {error}"),
  }
  let visible = settings.as_ref().map_or(true, |settings| settings.show_in_menu_bar);
  let _ = icon.set_visible(visible);
}

fn on_menu_event(app: &AppHandle, event: MenuEvent) {
  let Some(mcp) = app.try_state::<McpState>() else {
    return;
  };
  match event.id().as_ref() {
    "mcp-enabled" | "mcp-actions" | "hide-icon" => {
      let mut settings = mcp.settings().unwrap_or_default();
      match event.id().as_ref() {
        "mcp-enabled" => settings.enabled = !settings.enabled,
        "mcp-actions" => settings.allow_actions = !settings.allow_actions,
        _ => settings.show_in_menu_bar = false,
      }
      if let Err(error) = mcp::apply_settings(app, settings) {
        log::error!("could not save the MCP settings: {error}");
        refresh(app);
      }
    }
    "open" => background::show_window(app, None),
    "new-invoice" => background::show_window(app, Some("/yeni")),
    "activity-all" | "activity-0" | "activity-1" | "activity-2" | "activity-3" | "activity-4" => {
      background::show_window(app, Some("/mcp"))
    }
    "launch-at-login" => {
      let autolaunch = app.autolaunch();
      let result = if autolaunch.is_enabled().unwrap_or(false) {
        autolaunch.disable()
      } else {
        autolaunch.enable()
      };
      if let Err(error) = result {
        log::error!("could not change launch at login: {error}");
      }
      refresh(app);
    }
    "quit" => app.exit(0),
    _ => {}
  }
}

/// Creates the icon; `refresh` fills its menu.
pub fn create(app: &AppHandle) -> tauri::Result<()> {
  let icon = TrayIconBuilder::with_id("angaria")
    .icon(Image::from_bytes(ICON)?)
    .icon_as_template(true)
    .tooltip("Angaria")
    .show_menu_on_left_click(true)
    .on_menu_event(on_menu_event)
    .on_tray_icon_event(|icon, event| {
      // The times in the menu move on while it is closed.
      if let TrayIconEvent::Enter { .. } = event {
        refresh(icon.app_handle());
      }
    })
    .build(app)?;
  app.manage(Tray {
    icon: Mutex::new(Some(icon)),
    activity: Mutex::default(),
  });
  refresh(app);
  Ok(())
}

/// The webview's newest calls, after each one it logs.
#[tauri::command]
pub fn tray_set_activity(app: AppHandle, entries: Vec<TrayActivity>) {
  if let Some(tray) = app.try_state::<Tray>() {
    *tray.activity.lock().unwrap() = entries.into_iter().take(ACTIVITY_SIZE).collect();
  }
  refresh(&app);
}

#[cfg(test)]
mod tests {
  use super::*;

  const MINUTE: i64 = 60_000;

  fn call(title: &str, minutes_ago: i64, ok: bool, result: &str) -> TrayActivity {
    TrayActivity {
      title: title.into(),
      company: Some("Acme Yazılım".into()),
      at: 100 * 1440 * MINUTE - minutes_ago * MINUTE,
      ok,
      result: result.into(),
    }
  }

  fn view<'a>(settings: Option<&'a Settings>, activity: &'a [TrayActivity]) -> TrayView<'a> {
    TrayView {
      settings,
      port: None,
      failed: false,
      activity,
      launch_at_login: false,
      now: 100 * 1440 * MINUTE,
    }
  }

  #[test]
  fn relative_times_are_written_out() {
    let now = 10 * 1440 * MINUTE;
    assert_eq!(relative_time(now, now), "az önce");
    assert_eq!(relative_time(now, now + MINUTE), "az önce");
    assert_eq!(relative_time(now, now - 5 * MINUTE), "5 dakika önce");
    assert_eq!(relative_time(now, now - 61 * MINUTE), "1 saat önce");
    assert_eq!(relative_time(now, now - 1500 * MINUTE), "dün");
    assert_eq!(relative_time(now, now - 4 * 1440 * MINUTE), "4 gün önce");
  }

  #[test]
  fn a_call_reads_tool_company_time_and_result() {
    let now = 100 * 1440 * MINUTE;
    assert_eq!(
      activity_label(&call("Taslak oluştur", 5, true, "Taslak oluşturuldu"), now),
      "Taslak oluştur · Acme Yazılım · 5 dakika önce · Taslak oluşturuldu"
    );
    let failed = TrayActivity {
      company: None,
      ..call("Taslağı sil", 0, false, "İzin gerekir\nayrıntı")
    };
    assert_eq!(
      activity_label(&failed, now),
      "Taslağı sil · az önce · Hata: İzin gerekir"
    );
    let long = activity_label(&call("Faturaları listele", 0, true, &"x".repeat(200)), now);
    assert_eq!(long.chars().count(), LABEL_MAX);
    assert!(long.ends_with('…'));
  }

  #[test]
  fn the_status_line_follows_the_server() {
    let on = Settings {
      enabled: true,
      ..Settings::default()
    };
    let mut state = view(Some(&on), &[]);
    assert_eq!(status_line(&state), "MCP başlatılıyor…");
    state.port = Some(41235);
    assert_eq!(status_line(&state), "MCP açık, 127.0.0.1:41235");
    state.port = None;
    state.failed = true;
    assert_eq!(status_line(&state), "MCP başlatılamadı, Angaria’yı aç");
    assert_eq!(status_line(&view(None, &[])), "MCP kapalı");
  }

  #[test]
  fn the_menu_mirrors_the_settings_and_lists_five_calls() {
    let settings = Settings {
      enabled: true,
      allow_actions: true,
      ..Settings::default()
    };
    let calls: Vec<TrayActivity> = (0..7)
      .map(|index| call("Faturaları listele", index, true, "3 fatura"))
      .collect();
    let entries = menu_entries(&view(Some(&settings), &calls));
    assert_eq!(entries[1], check("mcp-enabled", "MCP", true));
    assert_eq!(entries[2], check("mcp-actions", ACTIONS_LABEL, true));
    let Entry::Submenu { text, entries: recent } = &entries[3] else {
      panic!("no Son ajan işlemleri");
    };
    assert_eq!(text, "Son ajan işlemleri");
    assert_eq!(recent.len(), ACTIVITY_SIZE + 2);
    assert_eq!(recent.last(), Some(&item("activity-all", "Tümünü gör")));
    let ids: Vec<&str> = entries
      .iter()
      .filter_map(|entry| match entry {
        Entry::Item { id, .. } | Entry::Check { id, .. } => Some(*id),
        _ => None,
      })
      .collect();
    assert_eq!(
      ids,
      [
        "mcp-status",
        "mcp-enabled",
        "mcp-actions",
        "open",
        "new-invoice",
        "launch-at-login",
        "hide-icon",
        "quit"
      ]
    );
  }

  #[test]
  fn an_empty_log_says_so() {
    let entries = menu_entries(&view(None, &[]));
    assert_eq!(entries[1], check("mcp-enabled", "MCP", false));
    let Entry::Submenu { entries: recent, .. } = &entries[3] else {
      panic!("no Son ajan işlemleri");
    };
    assert_eq!(
      recent[0],
      Entry::Item {
        id: "activity-none",
        text: "Henüz işlem yok".into(),
        enabled: false
      }
    );
  }
}
