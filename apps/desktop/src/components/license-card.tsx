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
  Input,
  toast,
} from '@angaria/ui';
import { useState } from 'react';
import {
  SettingsField,
  SettingsRow,
  SettingsSection,
  SettingsValue,
} from '@/components/settings-section.tsx';
import { errorMessage, toastError } from '@/lib/gib-errors.ts';
import {
  openCheckout,
  openCustomerPortal,
  useLicense,
  type LicenseState,
} from '@/lib/license-context.tsx';
import { normalizeLicenseKey } from '@/lib/license.ts';

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
    case 'trial':
      return status.daysLeft > 0
        ? `Deneme sürümü, ${status.daysLeft} gün kaldı`
        : 'Deneme sürümü, bugün bitiyor';
    default:
      return 'Etkin değil';
  }
}

/** During the trial: the key from the checkout's e-mail activates this Mac. */
function LicenseKeyRow() {
  const { activate } = useLicense();
  const [key, setKey] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleActivate() {
    if (!key) {
      setError('Lisans anahtarını yaz');
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await activate(key);
      toast.success('Angaria bu Mac’te etkinleştirildi');
    } catch (activateError) {
      setError(errorMessage(activateError));
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingsRow align="top" fill htmlFor="license-key" label="Lisans anahtarı">
      <SettingsField error={error} id="license-key">
        {(describedBy) => (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleActivate();
            }}
          >
            <Input
              aria-describedby={describedBy}
              aria-invalid={error ? true : undefined}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              id="license-key"
              onChange={(event) => {
                setKey(normalizeLicenseKey(event.target.value));
                setError(undefined);
              }}
              placeholder="ANGARIA-…"
              spellCheck={false}
              value={key}
            />
          </form>
        )}
      </SettingsField>
      <Button
        disabled={pending}
        focusableWhenDisabled
        onClick={() => void handleActivate()}
        variant="outline"
      >
        {pending ? 'Etkinleştiriliyor…' : 'Etkinleştir'}
      </Button>
    </SettingsRow>
  );
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
      toastError(error);
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
      {!license && !bypassed && <LicenseKeyRow />}
      <SettingsRow>
        {!license && <Button onClick={openCheckout}>Satın al</Button>}
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
