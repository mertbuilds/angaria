/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev only: the local GİB emulator for Ayarlar › Gelişmiş › Emülatör (.env.development). */
  readonly VITE_GIB_EMULATOR_URL?: string;
  /** Dev only: '1' answers GİB calls from src/dev/gib-fixtures.ts. */
  readonly VITE_GIB_FIXTURES?: string;
}
