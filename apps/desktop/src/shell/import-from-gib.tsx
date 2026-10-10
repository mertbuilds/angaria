import { useRouterState } from '@tanstack/react-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { onGIBLogin } from '@/lib/gib.ts';
import { useStore } from '@/lib/store.tsx';
import { ImportFromGIBDialog } from '@/pages/import-from-gib.tsx';
import { useRequireCredentials } from './credentials-guard.tsx';

const ImportFromGIBContext = createContext<(() => void) | null>(null);

/** Opens Eski faturalarından müşteri ve hizmetlerini al (Ayarlar, ⌘K). */
export function useImportFromGIB() {
  const open = useContext(ImportFromGIBContext);
  if (!open) {
    throw new Error('useImportFromGIB must be used within ImportFromGIBProvider');
  }
  return open;
}

/** Another dialog is open (SMS signing, ⌘K): the offer waits for a later login. */
const dialogOpen = () => document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;

/**
 * The import from past invoices, and its offer: right after a company's first
 * login GİB accepts, once per company, it opens with Atla. Never on Yeni
 * fatura or over another dialog; a later login offers it then. A login while
 * the window is hidden (an agent over MCP) offers it when the window shows.
 */
export function ImportFromGIBProvider({ children }: { children: ReactNode }) {
  const { activeEntity, activeEntityId, markImportOffered } = useStore();
  const requireCredentials = useRequireCredentials();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // A new key per opening starts the dialog over.
  const [state, setState] = useState({ entityId: '', key: 0, onboarding: false, open: false });
  // The user code of a login made while the window was hidden.
  const hiddenLogin = useRef<string | null>(null);

  const offer = useEffectEvent((username: string) => {
    if (activeEntity.importOffered || activeEntity.creds.username !== username) {
      return;
    }
    if (document.visibilityState === 'hidden') {
      hiddenLogin.current = username;
      return;
    }
    if (pathname.startsWith('/yeni') || dialogOpen()) {
      return;
    }
    markImportOffered(activeEntity.id);
    setState((current) => ({
      entityId: activeEntity.id,
      key: current.key + 1,
      onboarding: true,
      open: true,
    }));
  });

  useEffect(() => onGIBLogin((username) => offer(username)), []);

  useEffect(() => {
    const onVisible = () => {
      const username = hiddenLogin.current;
      if (document.visibilityState === 'visible' && username !== null) {
        hiddenLogin.current = null;
        offer(username);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const open = useCallback(() => {
    if (requireCredentials()) {
      setState((current) => ({
        entityId: activeEntityId,
        key: current.key + 1,
        onboarding: false,
        open: true,
      }));
    }
  }, [activeEntityId, requireCredentials]);

  return (
    <ImportFromGIBContext.Provider value={open}>
      {children}
      <ImportFromGIBDialog
        key={state.key}
        onboarding={state.onboarding}
        onOpenChange={(next) => setState((current) => ({ ...current, open: next }))}
        // The scan belongs to the company it started for: switching closes it.
        open={state.open && state.entityId === activeEntityId}
      />
    </ImportFromGIBContext.Provider>
  );
}
