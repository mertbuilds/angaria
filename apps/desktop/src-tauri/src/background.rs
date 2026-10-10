//! Angaria without a window (docs/adr/0012-mcp-in-the-background.md): while
//! MCP is on, closing the window hides it and the app keeps serving agents
//! from the menu bar, with no Dock icon. The webview stays loaded, hidden,
//! because the MCP tools run in it.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Emitter, Manager};

use crate::mcp::files::Settings;

/// The main window's label (tauri.conf.json).
pub const MAIN_WINDOW: &str = "main";
/// Starts without a window: the login item and the bridge pass it.
pub const BACKGROUND_ARG: &str = "--background";
/// The angaria-mcp bridge opened the app for an agent's call.
pub const FOR_MCP_ARG: &str = "--for-mcp";

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct LaunchArgs {
  pub background: bool,
  pub for_mcp: bool,
}

pub fn parse_args<I: IntoIterator<Item = S>, S: AsRef<str>>(args: I) -> LaunchArgs {
  let mut launch = LaunchArgs::default();
  for arg in args {
    match arg.as_ref() {
      BACKGROUND_ARG => launch.background = true,
      FOR_MCP_ARG => launch.for_mcp = true,
      _ => {}
    }
  }
  launch
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CloseAction {
  /// Hide the window, leave the Dock, keep serving agents.
  Hide,
  /// Close it; the app quits with its last window.
  Quit,
}

/// The window's close button and ⌘W. ⌘Q and Çık always quit.
pub fn close_action(settings: Option<&Settings>) -> CloseAction {
  if settings.is_some_and(|settings| settings.enabled) {
    CloseAction::Hide
  } else {
    CloseAction::Quit
  }
}

/// Whether the app stays running with its window hidden. Settings not yet
/// known (a first launch: the webview saves them in a moment) keep it.
pub fn stays_in_background(settings: Option<&Settings>, for_mcp: bool) -> bool {
  match settings {
    None => true,
    Some(settings) if settings.enabled => true,
    // Opened only for an agent, and MCP is off: nothing to do.
    Some(_) if for_mcp => false,
    // The menu bar icon can still open it; without it nothing can.
    Some(settings) => settings.show_in_menu_bar,
  }
}

/// Whether the window is hidden and whether the bridge opened the app.
pub struct Background {
  hidden: AtomicBool,
  for_mcp: AtomicBool,
}

impl Background {
  pub fn new(launch: LaunchArgs) -> Self {
    Self {
      hidden: AtomicBool::new(launch.background),
      for_mcp: AtomicBool::new(launch.background && launch.for_mcp),
    }
  }

  pub fn is_hidden(&self) -> bool {
    self.hidden.load(Ordering::SeqCst)
  }

  pub fn for_mcp(&self) -> bool {
    self.for_mcp.load(Ordering::SeqCst)
  }
}

#[cfg(target_os = "macos")]
fn set_policy(app: &AppHandle, policy: tauri::ActivationPolicy) {
  if let Err(error) = app.set_activation_policy(policy) {
    log::error!("could not set the activation policy: {error}");
  }
}

/// Shows the main window (and the Dock icon), on `route` when given.
pub fn show_window(app: &AppHandle, route: Option<&str>) {
  if let Some(state) = app.try_state::<Background>() {
    state.hidden.store(false, Ordering::SeqCst);
    state.for_mcp.store(false, Ordering::SeqCst);
  }
  #[cfg(target_os = "macos")]
  set_policy(app, tauri::ActivationPolicy::Regular);
  if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
  }
  if let Some(route) = route {
    let _ = app.emit("app:navigate", route);
  }
}

/// Hides the main window and leaves the Dock and the app switcher.
pub fn hide_window(app: &AppHandle) {
  if let Some(state) = app.try_state::<Background>() {
    state.hidden.store(true, Ordering::SeqCst);
  }
  if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
    let _ = window.hide();
  }
  #[cfg(target_os = "macos")]
  set_policy(app, tauri::ActivationPolicy::Accessory);
}

/// The settings changed while the window is hidden: quits when the app has
/// nothing left to do in the background.
pub fn settings_changed(app: &AppHandle, settings: Option<&Settings>) {
  let Some(state) = app.try_state::<Background>() else {
    return;
  };
  if state.is_hidden() && !stays_in_background(settings, state.for_mcp()) {
    log::info!("MCP is off with no window open: quitting");
    app.exit(0);
  }
}

/// The window asks before closing (src/lib/app-vault.ts): true when it was
/// hidden instead, so the webview keeps it.
#[tauri::command]
pub fn window_close_requested(app: AppHandle) -> bool {
  let settings = app
    .try_state::<crate::mcp::McpState>()
    .and_then(|mcp| mcp.settings());
  match close_action(settings.as_ref()) {
    CloseAction::Hide => {
      hide_window(&app);
      true
    }
    CloseAction::Quit => false,
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn settings(enabled: bool, show_in_menu_bar: bool) -> Settings {
    Settings {
      enabled,
      show_in_menu_bar,
      ..Settings::default()
    }
  }

  #[test]
  fn reads_the_background_launch_arguments() {
    assert_eq!(parse_args(["Angaria"]), LaunchArgs::default());
    assert_eq!(
      parse_args(["Angaria", "--background"]),
      LaunchArgs {
        background: true,
        for_mcp: false
      }
    );
    assert_eq!(
      parse_args(["Angaria", "--background", "--for-mcp"]),
      LaunchArgs {
        background: true,
        for_mcp: true
      }
    );
  }

  #[test]
  fn closing_hides_while_mcp_is_on_and_quits_otherwise() {
    assert_eq!(
      close_action(Some(&settings(true, true))),
      CloseAction::Hide
    );
    assert_eq!(
      close_action(Some(&settings(true, false))),
      CloseAction::Hide
    );
    assert_eq!(
      close_action(Some(&settings(false, true))),
      CloseAction::Quit
    );
    assert_eq!(close_action(None), CloseAction::Quit);
  }

  #[test]
  fn the_background_app_quits_once_it_has_nothing_to_do() {
    // MCP on: always stays.
    assert!(stays_in_background(Some(&settings(true, false)), true));
    assert!(stays_in_background(Some(&settings(true, true)), false));
    // Opened by the bridge for an agent, MCP off: quits even with the icon.
    assert!(!stays_in_background(Some(&settings(false, true)), true));
    // The login item with MCP off: stays only while the icon can open it.
    assert!(stays_in_background(Some(&settings(false, true)), false));
    assert!(!stays_in_background(Some(&settings(false, false)), false));
    // Not known yet: waits for the webview's settings.
    assert!(stays_in_background(None, true));
  }

  #[test]
  fn only_a_background_launch_counts_as_opened_for_mcp() {
    let launch = Background::new(LaunchArgs {
      background: false,
      for_mcp: true,
    });
    assert!(!launch.is_hidden());
    assert!(!launch.for_mcp());
    let launch = Background::new(parse_args(["--background", "--for-mcp"]));
    assert!(launch.is_hidden());
    assert!(launch.for_mcp());
  }
}
