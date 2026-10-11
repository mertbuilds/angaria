//! Quitting waits a moment for the webview to log out of GİB. The app's GİB
//! session stays open a while after the last call (src/lib/session-queue.ts),
//! and GİB refuses the next login while it is open, so a quit (Çık, ⌘Q, a
//! background quit) asks the webview first (`app:quit`) and exits once it
//! answers (`quit_ready`) or after QUIT_WAIT. Closing the last window is
//! handled by the webview before it closes (src/lib/app-vault.ts).

use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter, ExitRequestApi, Manager};

/// The longest a quit waits for the webview's logout.
const QUIT_WAIT: Duration = Duration::from_secs(3);

/// The macOS app menu's Quit, in place of the predefined one, so ⌘Q goes
/// through `app.exit` and can wait for the logout.
#[cfg(target_os = "macos")]
const QUIT_MENU_ID: &str = "app-quit";

#[derive(Default)]
pub struct Quit {
  asked: AtomicBool,
  code: AtomicI32,
  ready: AtomicBool,
}

/// What a request to exit does: exit now, or wait for the webview first.
#[derive(Debug, PartialEq)]
enum Plan {
  Exit,
  /// Already waiting: keep waiting.
  Wait,
  /// Ask the webview, then exit with the code.
  Ask(i32),
}

fn plan(quit: &Quit, code: Option<i32>) -> Plan {
  // The last window closed (the webview logged out before) or a relaunch.
  let Some(code) = code.filter(|code| *code != tauri::RESTART_EXIT_CODE) else {
    return Plan::Exit;
  };
  if quit.ready.load(Ordering::SeqCst) {
    return Plan::Exit;
  }
  if quit.asked.swap(true, Ordering::SeqCst) {
    return Plan::Wait;
  }
  quit.code.store(code, Ordering::SeqCst);
  Plan::Ask(code)
}

/// `RunEvent::ExitRequested`.
pub fn exit_requested(app: &AppHandle, code: Option<i32>, api: &ExitRequestApi) {
  let Some(quit) = app.try_state::<Quit>() else {
    return;
  };
  match plan(&quit, code) {
    Plan::Exit => {}
    Plan::Wait => api.prevent_exit(),
    Plan::Ask(code) => {
      api.prevent_exit();
      if app.emit("app:quit", ()).is_err() {
        finish(app);
        return;
      }
      let handle = app.clone();
      std::thread::spawn(move || {
        std::thread::sleep(QUIT_WAIT);
        log::info!("quitting without the webview's answer (code {code})");
        finish(&handle);
      });
    }
  }
}

fn finish(app: &AppHandle) {
  let Some(quit) = app.try_state::<Quit>() else {
    return;
  };
  if !quit.ready.swap(true, Ordering::SeqCst) {
    app.exit(quit.code.load(Ordering::SeqCst));
  }
}

/// The webview logged out of GİB (or gave up): the quit goes on.
#[tauri::command]
pub fn quit_ready(app: AppHandle) {
  finish(&app);
}

/// The default menu with its Quit routed through `app.exit`.
#[cfg(target_os = "macos")]
pub fn set_menu(app: &AppHandle) -> tauri::Result<()> {
  use tauri::menu::{Menu, MenuItem, MenuItemKind};

  let menu = Menu::default(app)?;
  if let Some(MenuItemKind::Submenu(app_menu)) = menu.items()?.into_iter().next() {
    // The predefined Quit is the app menu's last item.
    if let Some(last) = app_menu.items()?.last() {
      app_menu.remove(last)?;
    }
    let name = &app.package_info().name;
    app_menu.append(&MenuItem::with_id(
      app,
      QUIT_MENU_ID,
      format!("Quit {name}"),
      true,
      Some("CmdOrCtrl+Q"),
    )?)?;
  }
  app.set_menu(menu)?;
  app.on_menu_event(|app, event| {
    if event.id() == QUIT_MENU_ID {
      app.exit(0);
    }
  });
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn a_quit_asks_the_webview_once_then_exits() {
    let quit = Quit::default();
    assert_eq!(plan(&quit, Some(0)), Plan::Ask(0));
    assert_eq!(plan(&quit, Some(0)), Plan::Wait);
    quit.ready.store(true, Ordering::SeqCst);
    assert_eq!(plan(&quit, Some(0)), Plan::Exit);
  }

  #[test]
  fn the_last_window_and_a_relaunch_exit_at_once() {
    let quit = Quit::default();
    assert_eq!(plan(&quit, None), Plan::Exit);
    assert_eq!(plan(&quit, Some(tauri::RESTART_EXIT_CODE)), Plan::Exit);
    assert!(!quit.asked.load(Ordering::SeqCst));
  }
}
