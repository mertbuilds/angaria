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

/** Base64 of the UTF-8 text: header values are ASCII. */
const toBase64 = (text: string) =>
  btoa(Array.from(new TextEncoder().encode(text), (byte) => String.fromCodePoint(byte)).join(''));

/**
 * Writes `bytes` into the user's Downloads folder as `name`, or the first free
 * "name (2).pdf" (src-tauri/src/downloads.rs), and returns the file's path.
 */
export async function saveDownload(bytes: Uint8Array, name: string): Promise<string> {
  try {
    return await invoke<string>('save_download', bytes, {
      headers: { 'x-file-name': toBase64(name) },
    });
  } catch (error) {
    throw new Error('Dosya İndirilenler klasörüne kaydedilemedi. Tekrar dene.', { cause: error });
  }
}
