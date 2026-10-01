import { createFileRoute } from '@tanstack/react-router';
import { InvoiceDetail } from '@/pages/invoice-detail.tsx';

export const Route = createFileRoute('/faturalar/$ettn')({
  component: InvoiceDetailRoute,
});

function InvoiceDetailRoute() {
  const { ettn } = Route.useParams();
  return <InvoiceDetail ettn={ettn} />;
}
