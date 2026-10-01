import { Tabs, TabsList, TabsTrigger } from '@angaria/ui';
import { createFileRoute } from '@tanstack/react-router';
import { InvoiceTemplatesPage } from '@/pages/invoice-templates.tsx';
import { ItemTemplatesPage } from '@/pages/item-templates.tsx';

interface TemplatesSearch {
  /** Absent = invoice templates. */
  sekme?: 'kalemler';
}

export const Route = createFileRoute('/sablonlar')({
  component: TemplatesRoute,
  validateSearch: (search: Record<string, unknown>): TemplatesSearch =>
    search.sekme === 'kalemler' ? { sekme: 'kalemler' } : {},
});

function TemplatesRoute() {
  const { sekme } = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = sekme ?? 'faturalar';

  const tabs = (
    <Tabs
      onValueChange={(value) =>
        void navigate({
          replace: true,
          search: value === 'kalemler' ? { sekme: 'kalemler' } : {},
        })
      }
      value={tab}
    >
      <TabsList>
        <TabsTrigger value="faturalar">Fatura şablonları</TabsTrigger>
        <TabsTrigger value="kalemler">Kalem şablonları</TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return tab === 'kalemler' ? (
    <ItemTemplatesPage tabs={tabs} />
  ) : (
    <InvoiceTemplatesPage tabs={tabs} />
  );
}
