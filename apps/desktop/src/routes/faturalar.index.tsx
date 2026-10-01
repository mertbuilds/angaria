import { createFileRoute } from '@tanstack/react-router';
import { InvoicesPage } from '@/pages/invoices.tsx';
import { useRequireCredentials } from '@/shell/credentials-guard.tsx';
import { LegacyPage, useLegacyNavigate } from '@/shell/legacy-page.tsx';
import { PreviewTabStrip, usePreviewTabs } from '@/shell/preview-tabs.tsx';
import { Screen } from '@/shell/screen.tsx';

export const Route = createFileRoute('/faturalar/')({
  component: InvoicesRoute,
});

function InvoicesRoute() {
  const requireCredentials = useRequireCredentials();
  const onNavigate = useLegacyNavigate();
  const { openPreview } = usePreviewTabs();

  return (
    <Screen title="Faturalar" toolbar={<PreviewTabStrip />}>
      <LegacyPage>
        <InvoicesPage
          onNavigate={onNavigate}
          onPreview={openPreview}
          requireCredentials={requireCredentials}
        />
      </LegacyPage>
    </Screen>
  );
}
