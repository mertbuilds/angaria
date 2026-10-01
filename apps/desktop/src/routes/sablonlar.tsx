import { Tabs, TabsList, TabsTrigger } from '@angaria/ui';
import { createFileRoute } from '@tanstack/react-router';
import { InvoiceTemplatesPage } from '@/pages/invoice-templates.tsx';
import { ItemTemplatesPage } from '@/pages/item-templates.tsx';
import { LegacyPage, useLegacyNavigate } from '@/shell/legacy-page.tsx';
import { Screen } from '@/shell/screen.tsx';

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
  const onNavigate = useLegacyNavigate();
  const tab = sekme ?? 'faturalar';

  return (
    <Screen
      title="Şablonlar"
      toolbar={
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
      }
    >
      <LegacyPage>
        {tab === 'kalemler' ? (
          <ItemTemplatesPage />
        ) : (
          <InvoiceTemplatesPage onNavigate={onNavigate} />
        )}
      </LegacyPage>
    </Screen>
  );
}
