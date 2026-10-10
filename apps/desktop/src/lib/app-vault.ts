import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { secretDelete, secretGet, vaultRead, vaultWrite, windowCloseRequested } from './native.ts';
import { createVault, readLegacyItems } from './vault.ts';

/** The app's one vault, shared by the store and the license. */
export const vault = createVault({
  backend: { read: vaultRead, write: vaultWrite },
  migrate: () => readLegacyItems({ delete: secretDelete, get: secretGet }, localStorage),
});

/**
 * Writes a pending password change before the window closes. While MCP is
 * on, Rust hides the window instead and the webview stays for the tools.
 */
export function flushVaultOnClose() {
  if (isTauri()) {
    // flush never rejects, so the window always closes or hides.
    void getCurrentWindow().onCloseRequested(async (event) => {
      await vault.flush();
      if (await windowCloseRequested().catch(() => false)) {
        event.preventDefault();
      }
    });
  }
}
