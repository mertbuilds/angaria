import { createFileRoute } from '@tanstack/react-router';
import { SettingsPage } from '@/pages/settings.tsx';
import { Screen } from '@/shell/screen.tsx';

export const Route = createFileRoute('/ayarlar')({
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <Screen title="Ayarlar">
      <SettingsPage />
    </Screen>
  );
}
