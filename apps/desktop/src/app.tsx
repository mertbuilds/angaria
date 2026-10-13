import { Toaster } from '@angaria/ui';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { activeGibEmulatorURL } from '@/lib/gib-emulator.ts';
import { toastError } from '@/lib/gib-errors.ts';
import { StoreProvider } from '@/lib/store.tsx';
import { McpHost } from '@/shell/mcp-host.tsx';
import { useUpdateCheck } from '@/shell/use-update-check.ts';
import { router } from './router.tsx';

const openSettings = () => void router.navigate({ to: '/ayarlar' });

// Dev only: with the emulator on, sample data fills the active company's empty
// fields. import.meta.env.DEV is statically false in production builds, so the
// module never ships.
const EmulatorSeedOnStart =
  import.meta.env.DEV && activeGibEmulatorURL
    ? lazy(() => import('@/dev/emulator-seed-on-start.tsx'))
    : null;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.onError) {
        toastError(error, {
          openSettings,
          // A read: it goes again once an open GİB session is closed.
          retry: () => void queryClient.refetchQueries({ exact: true, queryKey: query.queryKey }),
        });
      }
    },
  }),
  mutationCache: new MutationCache({
    // Writes: never sent again on their own, also after closing a GİB session.
    onError: (error) => {
      toastError(error, { openSettings });
    },
  }),
});

export function App() {
  useUpdateCheck();

  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        {EmulatorSeedOnStart && (
          <Suspense fallback={null}>
            <EmulatorSeedOnStart />
          </Suspense>
        )}
        <McpHost />
        <RouterProvider router={router} />
      </StoreProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
