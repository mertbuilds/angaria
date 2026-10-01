import { createFileRoute } from '@tanstack/react-router';
import { CustomersPage } from '@/pages/customers.tsx';
import { LegacyPage } from '@/shell/legacy-page.tsx';
import { Screen } from '@/shell/screen.tsx';

export const Route = createFileRoute('/musteriler')({
  component: CustomersRoute,
});

function CustomersRoute() {
  return (
    <Screen title="Müşteriler">
      <LegacyPage>
        <CustomersPage />
      </LegacyPage>
    </Screen>
  );
}
