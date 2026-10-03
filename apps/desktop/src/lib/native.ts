import { invoke, isTauri } from '@tauri-apps/api/core';

export const vaultRead = () => invoke<string | null>('vault_read');
export const vaultWrite = (json: string) => invoke<void>('vault_write', { json });
// The keychain items before the vault, read and removed once by its migration.
export const secretGet = (key: string) => invoke<string | null>('secret_get', { key });
export const secretDelete = (key: string) => invoke<void>('secret_delete', { key });

/** GİB's invoice page as an A4-wide PDF, drawn by WebKit on this Mac (src-tauri/src/pdf.rs). */
export async function htmlToPDF(html: string): Promise<ArrayBuffer> {
  if (!isTauri()) {
    throw new Error('e-Arşiv PDF yalnızca uygulamada oluşturulur.');
  }
  try {
    return await invoke<ArrayBuffer>('html_to_pdf', { html });
  } catch (error) {
    throw new Error('e-Arşiv PDF oluşturulamadı. Tekrar dene.', { cause: error });
  }
}
