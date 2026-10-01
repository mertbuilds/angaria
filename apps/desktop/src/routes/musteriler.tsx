import { Tabs, TabsList, TabsTrigger } from '@angaria/ui';
import { createFileRoute } from '@tanstack/react-router';
import { CustomersPage } from '@/pages/customers.tsx';
import { ServicesPage } from '@/pages/services.tsx';

interface CustomersSearch {
  /** Absent = the customers. */
  sekme?: 'hizmetler';
}

export const Route = createFileRoute('/musteriler')({
  component: CustomersRoute,
  validateSearch: (search: Record<string, unknown>): CustomersSearch =>
    search.sekme === 'hizmetler' ? { sekme: 'hizmetler' } : {},
});

function CustomersRoute() {
  const { sekme } = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = sekme ?? 'musteriler';

  const tabs = (
    <Tabs
      onValueChange={(value) =>
        void navigate({
          replace: true,
          search: value === 'hizmetler' ? { sekme: 'hizmetler' } : {},
        })
      }
      value={tab}
    >
      <TabsList>
        <TabsTrigger value="musteriler">Müşteriler</TabsTrigger>
        <TabsTrigger value="hizmetler">Hizmetler</TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return tab === 'hizmetler' ? <ServicesPage tabs={tabs} /> : <CustomersPage tabs={tabs} />;
}
