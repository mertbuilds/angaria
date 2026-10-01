import { createFileRoute } from '@tanstack/react-router';
import { CustomersPage } from '@/pages/customers.tsx';

export const Route = createFileRoute('/musteriler')({
  component: CustomersPage,
});
