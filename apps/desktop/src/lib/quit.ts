import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { gib } from './gib.ts';
import { importRuns } from './import-run.ts';
import { quitReady } from './native.ts';

/** How long a quit waits for GİB's logout; Rust exits after 3 seconds anyway. */
const LOGOUT_WAIT_MS = 2000;

/**
 * Logs out of the open GİB session, also one a running call, the SMS dialog,
 * an MCP signing operation or an import holds, so the next launch is not
 * refused for an open session. The import stops first. Never rejects.
 */
export const closeGIBSession = () => {
  importRuns.cancel();
  return Promise.race([
    gib.quit(),
    new Promise<void>((resolve) => setTimeout(resolve, LOGOUT_WAIT_MS)),
  ]).catch(() => {});
};

/** Çık, ⌘Q and a background quit ask first (src-tauri/src/quit.rs): log out, then quit. */
export function closeGIBSessionOnQuit() {
  if (isTauri()) {
    void listen('app:quit', async () => {
      await closeGIBSession();
      await quitReady().catch(() => {});
    });
  }
}
