import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';

export type { Update };

/** The signed update from dl.angaria.app, or null when this is the latest version. */
export const checkForUpdate = () => check();

/**
 * Downloads and installs the update, then restarts the app. `onProgress` gets
 * the downloaded share from 0 to 1, or null while the size is unknown.
 */
export async function installUpdate(
  update: Update,
  onProgress?: (fraction: number | null) => void,
) {
  let total = 0;
  let received = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      total = event.data.contentLength ?? 0;
      onProgress?.(total > 0 ? 0 : null);
    } else if (event.event === 'Progress') {
      received += event.data.chunkLength;
      onProgress?.(total > 0 ? Math.min(received / total, 1) : null);
    }
  });
  await relaunch();
}
