import { Progress, toast } from '@angaria/ui';
import { useRouterState } from '@tanstack/react-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { describeError } from '@/lib/gib-errors.ts';
import { onGIBLogin } from '@/lib/gib.ts';
import { importRuns } from '@/lib/import-run.ts';
import { useStore } from '@/lib/store.tsx';
import { ImportFromGIBDialog, progressText } from '@/pages/import-from-gib.tsx';
import { useRequireCredentials } from './credentials-guard.tsx';

/** The indicator's toast id: one import run, one toast. */
const RUN_TOAST = 'gib-import-run';

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
 * While the dialog is closed, the import run shows in a toast at the bottom
 * right (its progress, Seçmeye hazır, or why it stopped) that opens the dialog
 * at the run's step. Opening the dialog while a run goes shows that run.
 */
export function ImportFromGIBProvider({ children }: { children: ReactNode }) {
  const { activeEntity, markImportOffered } = useStore();
  const requireCredentials = useRequireCredentials();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const run = useSyncExternalStore(importRuns.subscribe, importRuns.current);
  // A new key per opening starts the dialog over.
  const [state, setState] = useState({ key: 0, onboarding: false, open: false });
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

  // A run going needs no login of the active company: the dialog shows the run.
  const open = useCallback(() => {
    if (importRuns.current() || requireCredentials()) {
      setState((current) => ({ key: current.key + 1, onboarding: false, open: true }));
    }
  }, [requireCredentials]);

  useEffect(() => {
    if (!run || state.open) {
      toast.dismiss(RUN_TOAST);
      return;
    }
    const options = {
      action: { label: run.status === 'ready' ? 'Seç' : 'Aç', onClick: open },
      dismissible: false,
      duration: Number.POSITIVE_INFINITY,
      id: RUN_TOAST,
    };
    if (run.status === 'scanning') {
      const text = progressText(run.progress);
      toast(text.label, {
        ...options,
        description: (
          <Progress
            max={run.progress?.total || 1}
            value={run.progress ? run.progress.done : null}
            valueText={text.value}
          />
        ),
      });
    } else if (run.status === 'ready') {
      toast.success('Seçmeye hazır', {
        ...options,
        description: 'Faturaların tarandı. Kaydedilecek müşteri ve hizmetleri seç.',
      });
    } else {
      toast.error('İçe aktarma durdu', { ...options, description: describeError(run.error).text });
    }
  }, [open, run, state.open]);

  useEffect(() => () => void toast.dismiss(RUN_TOAST), []);

  return (
    <ImportFromGIBContext.Provider value={open}>
      {children}
      <ImportFromGIBDialog
        key={state.key}
        onboarding={state.onboarding}
        onOpenChange={(next) => setState((current) => ({ ...current, open: next }))}
        open={state.open}
      />
    </ImportFromGIBContext.Provider>
  );
}
