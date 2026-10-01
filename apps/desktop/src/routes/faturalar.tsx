import { createFileRoute } from '@tanstack/react-router';
import { InvoicesScreen } from '@/pages/invoices.tsx';

export const Route = createFileRoute('/faturalar')({
  component: InvoicesScreen,
});
