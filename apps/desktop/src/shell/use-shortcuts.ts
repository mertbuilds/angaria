import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { sections } from './nav.ts';
import { useAppActions } from './use-app-actions.ts';

const isMac = navigator.userAgent.includes('Mac');

/**
 * App-wide shortcuts: ⌘K palette, ⌘N new invoice, ⌘1-4 sections, ⌘, settings
 * (Ctrl instead of ⌘ off macOS).
 */
export function useShortcuts(setPaletteOpen: Dispatch<SetStateAction<boolean>>) {
  const { goTo, newInvoice } = useAppActions();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = isMac ? event.metaKey : event.ctrlKey;
      if (!mod || event.altKey || event.shiftKey || event.isComposing || event.defaultPrevented) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      const section = sections.find((item) =>
        key === ',' ? item.to === '/ayarlar' : item.key === key,
      );
      const action = key === 'n' ? newInvoice : section && (() => goTo(section.to));
      if (!action) {
        return;
      }
      event.preventDefault();
      setPaletteOpen(false);
      action();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [goTo, newInvoice, setPaletteOpen]);
}
