import { invoke } from '@tauri-apps/api/core';

export const vaultRead = () => invoke<string | null>('vault_read');
export const vaultWrite = (json: string) => invoke<void>('vault_write', { json });
// The keychain items before the vault, read and removed once by its migration.
export const secretGet = (key: string) => invoke<string | null>('secret_get', { key });
export const secretDelete = (key: string) => invoke<void>('secret_delete', { key });
