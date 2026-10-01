import { toast, Toaster } from '@angaria/ui';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { LicenseGate } from '@/components/license-gate.tsx';
import { LicenseProvider } from '@/lib/license-context.tsx';
import { StoreProvider } from '@/lib/store.tsx';
import { router } from './router.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.onError) {
        toast.error(error instanceof Error ? error.message : 'Bilinmeyen hata');
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Bilinmeyen hata');
    },
  }),
});

export function App() {
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
