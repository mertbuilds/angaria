import { isTauri } from '@tauri-apps/api/core';
import { saveDownload } from './native.ts';

/** A saved download: its file name and, in the app, where it is. */
export interface SavedFile {
  name: string;
  /** Null in a plain browser, whose own download keeps the path to itself. */
  path: string | null;
}

/**
 * Saves `blob` in the user's Downloads folder as `filename`, numbered
 * ("name (2).pdf") when that name is taken. A plain browser hands it to the
 * browser's download instead.
 */
export async function saveFile(blob: Blob, filename: string): Promise<SavedFile> {
  if (!isTauri()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { name: filename, path: null };
  }
  const path = await saveDownload(new Uint8Array(await blob.arrayBuffer()), filename);
  return { name: path.slice(path.lastIndexOf('/') + 1), path };
}
