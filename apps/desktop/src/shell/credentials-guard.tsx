import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@angaria/ui';
import { useNavigate } from '@tanstack/react-router';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useStore } from '@/lib/store.tsx';

const RequireCredentialsContext = createContext<(() => boolean) | null>(null);

/**
 * Returns a guard to call before any GİB request: true when the active entity
 * has a username and a saved password, otherwise false after asking the user
 * to fill them in under Ayarlar.
 */
export function useRequireCredentials() {
  const requireCredentials = useContext(RequireCredentialsContext);
  if (!requireCredentials) {
    throw new Error('useRequireCredentials must be used within CredentialsGuard');
  }
  return requireCredentials;
}

export function CredentialsGuard({ children }: { children: ReactNode }) {
  const { hasCredentials } = useStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const requireCredentials = useCallback(() => {
    if (hasCredentials) {
      return true;
    }
    setOpen(true);
    return false;
  }, [hasCredentials]);

  return (
    <RequireCredentialsContext.Provider value={requireCredentials}>
      {children}
      <AlertDialog onOpenChange={setOpen} open={open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>GİB kimlik bilgileri gerekli</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlemi gerçekleştirmek için GİB kullanıcı adı ve şifrenizi girmeniz gerekiyor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOpen(false);
                void navigate({ to: '/ayarlar' });
              }}
            >
              Ayarlara git
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RequireCredentialsContext.Provider>
  );
}
