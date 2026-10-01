import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog.tsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { openCustomerPortal, useLicense, type LicenseState } from '@/lib/license-context.tsx';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' });

function describe(status: LicenseState, bypassed: boolean) {
  if (bypassed) {
    return 'Geliştirme modu: lisans kontrolü kapalı.';
  }
  switch (status.kind) {
    case 'valid':
      return 'Lisans bu cihazda etkin.';
    case 'grace':
      return `Polar'a bağlanılamadı. Lisansın ${status.daysLeft} gün içinde doğrulanması gerekiyor.`;
    default:
      return 'Lisans etkin değil.';
  }
}

export function LicenseCard() {
  const { bypassed, deactivate, license, status } = useLicense();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleDeactivate() {
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
    <Card>
      <CardHeader>
        <CardTitle>Lisans</CardTitle>
        <CardDescription>{describe(status, bypassed)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {license && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Anahtar</dt>
            <dd className="font-mono">{license.displayKey}</dd>
            {license.customerEmail && (
              <>
                <dt className="text-muted-foreground">E-posta</dt>
                <dd>{license.customerEmail}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Son doğrulama</dt>
            <dd>{formatDate(license.lastValidatedAt)}</dd>
            {license.expiresAt && (
              <>
                <dt className="text-muted-foreground">Bitiş</dt>
                <dd>{formatDate(license.expiresAt)}</dd>
              </>
            )}
          </dl>
        )}
        <div className="flex gap-2">
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
        </div>
      </CardContent>
      <ConfirmDialog
        confirmLabel="Kaldır"
        description="Bu cihazın lisansı kaldırılır ve Angaria kilitlenir. Aynı anahtarla bu cihazı ya da başka bir cihazı etkinleştirebilirsiniz."
        onConfirm={() => void handleDeactivate()}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title="Bu cihazı kaldır"
      />
    </Card>
  );
}
