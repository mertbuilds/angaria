//! Keeps App Nap away while the MCP server runs: with its window hidden the
//! app counts as idle, and macOS would slow its timers and network threads
//! until an agent's call waits seconds for an answer. Idle system sleep stays
//! allowed.

#[cfg(target_os = "macos")]
mod imp {
  use objc2::rc::Retained;
  use objc2::runtime::{NSObjectProtocol, ProtocolObject};
  use objc2_foundation::{NSActivityOptions, NSProcessInfo, NSString};

  pub struct Awake(Retained<ProtocolObject<dyn NSObjectProtocol>>);

  // The activity token is an immutable object NSProcessInfo hands out and
  // takes back from any thread.
  unsafe impl Send for Awake {}

  impl Awake {
    pub fn begin() -> Self {
      let reason = NSString::from_str("Angaria MCP sunucusu ajanlara yanıt veriyor");
      Self(
        NSProcessInfo::processInfo().beginActivityWithOptions_reason(
          NSActivityOptions::UserInitiatedAllowingIdleSystemSleep,
          &reason,
        ),
      )
    }
  }

  impl Drop for Awake {
    fn drop(&mut self) {
      // SAFETY: the token came from beginActivityWithOptions:reason:.
      unsafe { NSProcessInfo::processInfo().endActivity(&self.0) };
    }
  }
}

#[cfg(not(target_os = "macos"))]
mod imp {
  pub struct Awake;

  impl Awake {
    pub fn begin() -> Self {
      Self
    }
  }
}

pub use imp::Awake;
