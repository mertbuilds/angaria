import { colors, font } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { Outlet, useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store.tsx';
import { AppSidebar } from './app-sidebar.tsx';
import { CommandPalette } from './command-palette.tsx';
import { CredentialsGuard } from './credentials-guard.tsx';
import { tones } from './palette.stylex.ts';
import { shell } from './shell.stylex.ts';
import { useShortcuts } from './use-shortcuts.ts';

const styles = create({
  // The content floats as a rounded panel on the sidebar's tone; the gaps
  // around it are the root's, so they drag the window too.
  main: {
    backgroundColor: colors.bg,
    borderRadius: shell.panelRadius,
    boxShadow: tones.panelShadow,
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    marginBlock: shell.panelInset,
    marginInlineEnd: shell.panelInset,
    minWidth: 0,
    overflow: 'hidden',
  },
  root: {
    backgroundColor: tones.sidebar,
    color: colors.fg,
    display: 'flex',
    fontFamily: font.family,
    height: '100vh',
    overflow: 'hidden',
  },
});

/** A new company starts clean: blank invoice form, no invoice of the old one open. */
function useResetOnEntityChange() {
  const { activeEntityId, resetInvoiceForm } = useStore();
  const navigate = useNavigate();
  const router = useRouter();
  const previous = useRef(activeEntityId);

  useEffect(() => {
    if (previous.current === activeEntityId) {
      return;
    }
    previous.current = activeEntityId;
    resetInvoiceForm();
    if (router.state.location.pathname.startsWith('/faturalar/')) {
      void navigate({ to: '/faturalar' });
    }
  }, [activeEntityId, navigate, resetInvoiceForm, router]);
}

function ShellLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  useShortcuts(setPaletteOpen);
  useResetOnEntityChange();

  return (
    <div data-tauri-drag-region {...props(styles.root)}>
      <AppSidebar onOpenPalette={() => setPaletteOpen(true)} />
      <main {...props(styles.main)}>
        <Outlet />
      </main>
      <CommandPalette onOpenChange={setPaletteOpen} open={paletteOpen} />
    </div>
  );
}

/**
 * The root route: sidebar, the routed main area, the ⌘K palette and the
 * shortcuts, inside the credentials guard.
 */
export function AppShell() {
  return (
    <CredentialsGuard>
      <ShellLayout />
    </CredentialsGuard>
  );
}
