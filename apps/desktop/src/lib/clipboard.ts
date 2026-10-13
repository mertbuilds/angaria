import { toast } from '@angaria/ui';

/** Copies `text` and says `done` in a toast, or that it could not. */
export async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error('Panoya kopyalanamadı. Tekrar dene.');
  }
}
