/** The stable installer link a release writes to (docs/release.md). */
const DEFAULT_DOWNLOAD_URL = 'https://dl.angaria.app/latest/Angaria.dmg';

/** Angaria's public source code. */
export const SOURCE_URL = 'https://github.com/mertbuilds/angaria';
/** Lines of a file in the source code. lib/config.test.ts fails when they move. */
interface SourceLines {
  file: string;
  lines: readonly [number, number];
}

const sourceLinesUrl = ({ file, lines: [first, last] }: SourceLines) =>
  `${SOURCE_URL}/blob/main/${file}#L${first}${first === last ? '' : `-L${last}`}`;

/** The hosts the desktop app may call: its http allowlist. */
export const APP_HOSTS_SOURCE: SourceLines = {
  file: 'apps/desktop/src-tauri/capabilities/default.json',
  lines: [61, 69],
};
export const APP_HOSTS_SOURCE_URL = sourceLinesUrl(APP_HOSTS_SOURCE);
/** The one host the updater asks for new versions. */
export const UPDATER_SOURCE: SourceLines = {
  file: 'apps/desktop/src-tauri/tauri.conf.json',
  lines: [72, 72],
};
export const UPDATER_SOURCE_URL = sourceLinesUrl(UPDATER_SOURCE);
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
