import { createFileRoute, redirect } from '@tanstack/react-router';
import { CustomersPage } from '@/pages/customers.tsx';

export const Route = createFileRoute('/musteriler')({
  // Hizmetler was a tab here (?sekme=hizmetler) before it got its own section.
  beforeLoad: ({ location }) => {
    if (new URLSearchParams(location.searchStr).get('sekme') === 'hizmetler') {
      throw redirect({ replace: true, to: '/hizmetler' });
    }
  },
  component: CustomersPage,
});
