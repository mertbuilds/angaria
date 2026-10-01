import { ReloadIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { openCheckout, openCustomerPortal, useLicense } from '@/lib/license-context.tsx';
import type { LicenseStatus } from '@/lib/license.ts';

type LockedStatus = Exclude<LicenseStatus, { kind: 'grace' } | { kind: 'valid' }>;

const lockedCopy: Record<
  'invalid' | 'offline' | 'subscription' | 'unlicensed',
  { description: string; title: string }
> = {
  unlicensed: {
    title: "Angaria'yı etkinleştirin",
    description: 'Satın aldıktan sonra e-postanıza gelen lisans anahtarını girin.',
  },
  invalid: {
    title: 'Lisans geçerli değil',
    description: 'Bu cihazın lisansı doğrulanamadı. Lisans anahtarınızı yeniden girin.',
  },
  subscription: {
    title: 'Lisansın süresi doldu',
    description: 'Aboneliğiniz sona erdi. Devam etmek için aboneliğinizi yenileyin.',
  },
  offline: {
    title: 'Lisans doğrulanmalı',
    description:
      'Lisansınızın çevrimiçi doğrulanması gerekiyor. İnternete bağlanıp tekrar deneyin.',
  },
};

const copyFor = (status: LockedStatus) =>
  lockedCopy[status.kind === 'expired' ? status.reason : status.kind];

function DragRegion() {
  return <div className="absolute inset-x-0 top-0 h-11" data-tauri-drag-region />;
}

function LicenseSplash() {
  return (
    <div className="relative flex h-screen flex-col items-center justify-center gap-3">
      <DragRegion />
      <HugeiconsIcon
        className="size-6 animate-spin text-muted-foreground"
        icon={ReloadIcon}
        strokeWidth={1.5}
      />
      <p className="text-xs text-muted-foreground">Lisans doğrulanıyor...</p>
    </div>
  );
}

function LicenseScreen({ status }: { status: LockedStatus }) {
  const { activate, check, error: checkError } = useLicense();
  const [key, setKey] = useState('');
  const [pending, setPending] = useState<'activate' | 'check' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = copyFor(status);
  const needsOnlineCheck = status.kind === 'expired' && status.reason === 'offline';

  async function handleActivate(event: FormEvent) {
    event.preventDefault();
    if (!key.trim()) {
      return;
    }
    setPending('activate');
    setError(null);
    try {
      await activate(key);
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : 'Bilinmeyen hata');
    } finally {
      setPending(null);
    }
  }

  async function handleRetry() {
    setPending('check');
    try {
      await check();
    } finally {
      setPending(null);
    }
  }

  const message = error ?? checkError;

  return (
    <div className="relative flex h-screen items-center justify-center px-6">
      <DragRegion />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {needsOnlineCheck ? (
            <Button className="w-full" disabled={pending !== null} onClick={handleRetry}>
              {pending === 'check' ? 'Doğrulanıyor...' : 'Tekrar dene'}
            </Button>
          ) : (
            <form className="space-y-3" onSubmit={handleActivate}>
              <div className="space-y-2">
                <Label htmlFor="license-key">Lisans anahtarı</Label>
                <Input
                  autoComplete="off"
                  autoFocus
                  id="license-key"
                  onChange={(event) => setKey(event.target.value)}
                  placeholder="ANGARIA-..."
                  spellCheck={false}
                  value={key}
                />
              </div>
              <Button className="w-full" disabled={pending !== null || !key.trim()} type="submit">
                {pending === 'activate' ? 'Etkinleştiriliyor...' : 'Etkinleştir'}
              </Button>
            </form>
          )}
          {message && <p className="text-sm text-destructive">{message}</p>}
          <div className="flex flex-col items-center">
            <Button onClick={openCheckout} size="sm" variant="link">
              Satın al / 14 gün ücretsiz dene
            </Button>
            {status.kind === 'expired' && status.reason === 'subscription' && (
              <Button onClick={openCustomerPortal} size="sm" variant="link">
                Aboneliği yönet
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GraceBanner({ daysLeft }: { daysLeft: number }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center">
      <p className="rounded-full border bg-background px-4 py-1.5 text-xs text-muted-foreground">
        {daysLeft > 0
          ? `Polar'a bağlanılamadı. Lisansın ${daysLeft} gün içinde doğrulanması gerekiyor.`
          : "Polar'a bağlanılamadı. Lisansın bugün doğrulanması gerekiyor."}
      </p>
    </div>
  );
}

export function LicenseGate({ children }: { children: ReactNode }) {
  const { status } = useLicense();

  switch (status.kind) {
    case 'checking':
      return <LicenseSplash />;
    case 'valid':
      return children;
    case 'grace':
      return (
        <>
          {children}
          <GraceBanner daysLeft={status.daysLeft} />
        </>
      );
    default:
      return <LicenseScreen status={status} />;
  }
}
