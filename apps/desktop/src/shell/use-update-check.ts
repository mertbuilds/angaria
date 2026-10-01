import { toast } from '@angaria/ui';
import { useEffect } from 'react';
import { checkForUpdate, installUpdate, type Update } from '@/lib/updater.ts';

const TOAST_ID = 'update';

let checked = false;

async function install(update: Update) {
  toast.loading('Güncelleme indiriliyor...', { id: TOAST_ID });
  try {
    await installUpdate(update);
  } catch (error) {
    toast.error('Güncelleme yüklenemedi', {
      description: error instanceof Error ? error.message : undefined,
      id: TOAST_ID,
    });
  }
}

/**
 * Checks for an update once per launch, in the background, and offers it in a
 * toast. Skipped in dev, where there is no signed build to replace.
 */
export function useUpdateCheck() {
  useEffect(() => {
    if (import.meta.env.DEV || checked) {
      return;
    }
    checked = true;
    checkForUpdate()
      .then((update) => {
        if (!update) {
          return;
        }
        toast(`Yeni sürüm var: ${update.version}`, {
          action: { label: 'Yükle', onClick: () => void install(update) },
          description: 'Yüklendikten sonra Angaria yeniden başlar.',
          duration: Number.POSITIVE_INFINITY,
          id: TOAST_ID,
        });
      })
      .catch(() => {
        // Offline or no release published: the next launch checks again.
      });
  }, []);
}
