import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  toast,
} from '@angaria/ui';
import { useState } from 'react';
import { SettingsRow, SettingsSection, SettingsValue } from '@/components/settings-section.tsx';
import { openCustomerPortal, useLicense, type LicenseState } from '@/lib/license-context.tsx';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' });

function describe(status: LicenseState, bypassed: boolean) {
  if (bypassed) {
    return 'Geliştirme modu, lisans kontrolü kapalı';
  }
  switch (status.kind) {
    case 'valid':
      return 'Bu Mac’te etkin';
    case 'grace':
      return `Sunucuya ulaşılamadı. ${status.daysLeft} gün içinde doğrulanmalı`;
    default:
      return 'Etkin değil';
  }
}

export function LicenseCard() {
  const { bypassed, deactivate, license, status } = useLicense();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleDeactivate() {
    setConfirmOpen(false);
    setRemoving(true);
    try {
      await deactivate();
      toast.success('Bu Mac lisanstan kaldırıldı');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bu Mac kaldırılamadı. Tekrar dene.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <SettingsSection description="Bir lisans en fazla üç Mac’te etkin olur." title="Lisans">
      <SettingsRow label="Durum">
        <SettingsValue tone={status.kind === 'grace' ? 'warning' : 'default'}>
          {describe(status, bypassed)}
        </SettingsValue>
      </SettingsRow>
      {license && (
        <>
          <SettingsRow label="Anahtar">
            <SettingsValue>{license.displayKey}</SettingsValue>
          </SettingsRow>
          {license.customerEmail && (
            <SettingsRow label="E-posta">
              <SettingsValue>{license.customerEmail}</SettingsValue>
            </SettingsRow>
          )}
          {license.expiresAt && (
            <SettingsRow label="Bitiş">
              <SettingsValue>{formatDate(license.expiresAt)}</SettingsValue>
            </SettingsRow>
          )}
          <SettingsRow label="Son doğrulama">
            <SettingsValue>{formatDate(license.lastValidatedAt)}</SettingsValue>
          </SettingsRow>
        </>
      )}
      <SettingsRow>
        <Button onClick={openCustomerPortal} variant="outline">
          Aboneliği yönet
        </Button>
        <Button
          disabled={!license || removing}
          onClick={() => setConfirmOpen(true)}
          variant="outline"
        >
          {removing ? 'Kaldırılıyor…' : 'Bu Mac’i kaldır'}
        </Button>
      </SettingsRow>
      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bu Mac kaldırılsın mı?</AlertDialogTitle>
            <AlertDialogDescription>
              Angaria bu Mac’te kilitlenir. Aynı anahtarla bu Mac’i ya da başka bir Mac’i sonra
              yeniden etkinleştirebilirsin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeactivate()} variant="destructive">
              Kaldır
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}
