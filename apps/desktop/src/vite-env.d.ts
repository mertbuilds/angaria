/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev only: the local GİB emulator for Ayarlar › Gelişmiş › Emülatör (.env.development). */
  readonly VITE_GIB_EMULATOR_URL?: string;
  /** Dev only: '1' answers GİB calls from src/dev/gib-fixtures.ts. */
  readonly VITE_GIB_FIXTURES?: string;
  readonly VITE_LICENSE_BYPASS?: string;
  readonly VITE_POLAR_API_BASE: string;
  readonly VITE_POLAR_CHECKOUT_URL: string;
  readonly VITE_POLAR_ORGANIZATION_ID: string;
  readonly VITE_POLAR_PORTAL_URL: string;
}
