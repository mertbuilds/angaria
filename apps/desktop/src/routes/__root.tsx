import { createRootRoute, Navigate } from '@tanstack/react-router';
import { AppShell } from '@/shell/app-shell.tsx';

export const Route = createRootRoute({
  component: AppShell,
  notFoundComponent: () => <Navigate replace to="/faturalar" />,
});
