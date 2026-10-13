/** The stable installer link a release writes to (docs/release.md). */
const DEFAULT_DOWNLOAD_URL = 'https://dl.angaria.app/latest/Angaria.dmg';

/** Angaria's public source code. */
export const SOURCE_URL = 'https://github.com/mertbuilds/angaria';
/**
 * The hosts the desktop app may call (its http allowlist), at the exact lines
 * of the source file. lib/config.test.ts fails when those lines move.
 */
export const APP_HOSTS_SOURCE = {
  file: 'apps/desktop/src-tauri/capabilities/default.json',
  lines: [61, 69] as const,
};
export const APP_HOSTS_SOURCE_URL = `${SOURCE_URL}/blob/main/${APP_HOSTS_SOURCE.file}#L${APP_HOSTS_SOURCE.lines[0]}-L${APP_HOSTS_SOURCE.lines[1]}`;
/** The license the code is published under, AGPL-3.0-only. */
export const LICENSE_URL = `${SOURCE_URL}/blob/main/LICENSE`;

type Env = Partial<Record<keyof ImportMetaEnv, string | undefined>>;

function read(env: Env, name: keyof ImportMetaEnv): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

/** The site's build-time config, from the VITE_ values in apps/web/.env.*. */
export function readConfig(env: Env) {
  return {
    downloadUrl: read(env, 'VITE_DOWNLOAD_URL') ?? DEFAULT_DOWNLOAD_URL,
    // No client id, no analytics: lib/analytics.ts never loads OpenPanel.
    openpanelClientId: read(env, 'VITE_OPENPANEL_CLIENT_ID'),
  };
}

export const config = readConfig(import.meta.env);
