import { Toaster } from '@angaria/ui';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { LicenseGate } from '@/components/license-gate.tsx';
import { toastError } from '@/lib/gib-errors.ts';
import { LicenseProvider } from '@/lib/license-context.tsx';
import { StoreProvider } from '@/lib/store.tsx';
import { useUpdateCheck } from '@/shell/use-update-check.ts';
import { router } from './router.tsx';

const openSettings = () => void router.navigate({ to: '/ayarlar' });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.onError) {
        toastError(error, { openSettings });
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      toastError(error, { openSettings });
    },
  }),
});

export function App() {
  // Outside the license gate: a locked app still gets fixes.
  useUpdateCheck();

  return (
    <QueryClientProvider client={queryClient}>
      <LicenseProvider>
        <StoreProvider>
          <LicenseGate>
            <RouterProvider router={router} />
          </LicenseGate>
        </StoreProvider>
      </LicenseProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
