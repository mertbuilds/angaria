import { createFileRoute } from '@tanstack/react-router';
import { NoInvoiceOpen } from '@/pages/invoice-detail.tsx';

export const Route = createFileRoute('/faturalar/')({
  component: NoInvoiceOpen,
});
