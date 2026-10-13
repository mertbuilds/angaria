import { toast } from '@angaria/ui';
import { create, props } from '@stylexjs/stylex';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import type { SavedFile } from './save-file.ts';

/** Twice a plain toast's four seconds: time to reach for Finder’da göster or Aç. */
export const DOWNLOAD_TOAST_DURATION = 8000;

/**
 * The characters a long file name keeps after the cut: GİB's number, a " (2)"
 * and the extension ("GIB2026000000001 (2).pdf").
 */
const TAIL_LENGTH = 24;

const styles = create({
  // Inline, so the toast's description still trims its line to the cap
  // height (base.css); top-aligned, as a clipped box has no text baseline.
  name: {
    display: 'inline-flex',
    maxWidth: '100%',
    verticalAlign: 'top',
  },
  head: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'pre',
  },
  tail: {
    flexShrink: 0,
    whiteSpace: 'pre',
  },
});

/** `name` split where a cut in the middle goes: all but the last characters, and those. */
export function splitFileName(name: string): [head: string, tail: string] {
  const characters = Array.from(name);
  const cut = Math.max(0, characters.length - TAIL_LENGTH);
  return [characters.slice(0, cut).join(''), characters.slice(cut).join('')];
}

/**
 * A file name that, when it does not fit, loses its middle to an ellipsis:
 * the start and the end (number, extension) stay. The whole name is in the
 * text, for screen readers and the tooltip.
 */
export function FileName({ name }: { name: string }) {
  const [head, tail] = splitFileName(name);
  return (
    <span title={name} {...props(styles.name)}>
      <span {...props(styles.head)}>{head}</span>
      <span {...props(styles.tail)}>{tail}</span>
    </span>
  );
}

/**
 * A download's loading toast. It carries the finished toast's duration
 * already: sonner reads a toast's duration once, when it first shows.
 */
export const toastPreparing = (text: string, id?: number | string) =>
  toast.loading(text, { duration: DOWNLOAD_TOAST_DURATION, id });

/**
 * Turns toast `id` (the download's loading toast) into the saved file: the
 * title, the file's name and, in the app, Finder’da göster and Aç.
 */
export function toastDownloaded(id: number | string, title: string, { name, path }: SavedFile) {
  toast.success(title, {
    action: path
      ? {
          label: 'Finder’da göster',
          onClick: () =>
            void revealItemInDir(path).catch(() =>
              toast.error('Dosya Finder’da gösterilemedi. Taşınmış ya da silinmiş olabilir.'),
            ),
        }
      : undefined,
    cancel: path
      ? {
          label: 'Aç',
          onClick: () =>
            void openPath(path).catch(() =>
              toast.error('Dosya açılamadı. Taşınmış ya da silinmiş olabilir.'),
            ),
        }
      : undefined,
    closeButton: true,
    description: <FileName name={name} />,
    duration: DOWNLOAD_TOAST_DURATION,
    id,
  });
}
