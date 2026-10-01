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
      return 'Bu cihazda etkin';
    case 'grace':
      return `Polar'a bağlanılamadı. ${status.daysLeft} gün içinde doğrulanmalı.`;
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
      toast.success('Bu cihaz lisanstan kaldırıldı');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Cihaz kaldırılamadı');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <SettingsSection description="Lisans en fazla üç cihazda etkin olabilir." title="Lisans">
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
          {removing ? 'Kaldırılıyor...' : 'Bu cihazı kaldır'}
        </Button>
      </SettingsRow>
      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bu cihazı kaldır</AlertDialogTitle>
            <AlertDialogDescription>
              Bu cihazın lisansı kaldırılır ve Angaria kilitlenir. Aynı anahtarla bu cihazı ya da
              başka bir cihazı yeniden etkinleştirebilirsiniz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeactivate()} variant="destructive">
              Kaldır
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}
