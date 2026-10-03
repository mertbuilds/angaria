import { Button, capStyles, Input, Wordmark } from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { LoaderCircleIcon, TriangleAlertIcon } from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { errorMessage } from '@/lib/gib-errors.ts';
import { openCheckout, openCustomerPortal, useLicense } from '@/lib/license-context.tsx';
import { normalizeLicenseKey, type LicenseStatus } from '@/lib/license.ts';
import { shell } from '../shell/shell.stylex.ts';

type LockedStatus = Exclude<LicenseStatus, { kind: 'grace' } | { kind: 'valid' }>;

const lockedCopy: Record<
  'invalid' | 'offline' | 'subscription' | 'unlicensed',
  { description: string; title: string }
> = {
  unlicensed: {
    title: 'Angaria’yı etkinleştir',
    description: 'Denemeyi ya da aboneliği başlatınca e-postana gelen lisans anahtarını gir.',
  },
  invalid: {
    title: 'Lisansı yeniden etkinleştir',
    description: 'Lisans sunucusu bu Mac’i tanımıyor. Lisans anahtarını yeniden gir.',
  },
  subscription: {
    title: 'Lisansın süresi doldu',
    description: 'Devam etmek için aboneliğini yenile. Kestiğin faturalar GİB’de durur.',
  },
  offline: {
    title: 'Lisans doğrulanmalı',
    description: 'Lisansını doğrulamak için internete bağlan ve tekrar dene.',
  },
};

const copyFor = (status: LockedStatus) =>
  lockedCopy[status.kind === 'expired' ? status.reason : status.kind];

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

const styles = create({
  banner: {
    alignItems: 'center',
    backgroundColor: `color-mix(in oklab, ${colors.warning} 10%, ${colors.bg})`,
    borderColor: `color-mix(in oklab, ${colors.warning} 40%, transparent)`,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: colors.fg,
    display: 'flex',
    fontFamily: font.family,
    fontSize: font.sizeXs,
    gap: spacing.s2,
    lineHeight: 1.4,
    margin: 0,
    paddingBlock: spacing.s2,
    paddingInline: spacing.s4,
  },
  bannerIcon: {
    color: colors.warning,
    flexShrink: 0,
    height: '14px',
    width: '14px',
  },
  bannerWrap: {
    bottom: spacing.s4,
    display: 'flex',
    insetInline: 0,
    justifyContent: 'center',
    pointerEvents: 'none',
    position: 'fixed',
    zIndex: 50,
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s8,
    maxWidth: '360px',
    width: '100%',
  },
  copy: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    textAlign: 'center',
  },
  description: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  drag: {
    height: shell.toolbarHeight,
    insetInline: 0,
    position: 'absolute',
    top: 0,
  },
  error: {
    color: colors.error,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
  },
  links: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  screen: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    boxSizing: 'border-box',
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    height: '100vh',
    justifyContent: 'center',
    paddingInline: spacing.s6,
    position: 'relative',
  },
  spinner: {
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: spin,
    },
    animationTimingFunction: 'linear',
    color: colors.muted,
    height: '20px',
    width: '20px',
  },
  splash: {
    gap: spacing.s3,
  },
  splashText: {
    color: colors.muted,
    fontSize: font.sizeXs,
    margin: 0,
  },
  title: {
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
    lineHeight: 1.3,
    margin: 0,
    textWrap: 'balance',
  },
  wide: {
    width: '100%',
  },
  wordmark: {
    fontSize: '28px',
  },
});

function DragRegion() {
  return <div data-tauri-drag-region {...props(styles.drag)} />;
}

function LicenseSplash() {
  return (
    <div {...props(styles.screen, styles.splash)}>
      <DragRegion />
      <LoaderCircleIcon aria-hidden {...props(styles.spinner)} />
      <p {...props(styles.splashText)}>Lisans doğrulanıyor…</p>
    </div>
  );
}

function LicenseScreen({ status }: { status: LockedStatus }) {
  const { activate, check, error: checkError } = useLicense();
  const [key, setKey] = useState('');
  const keyRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<'activate' | 'check' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = copyFor(status);
  const needsOnlineCheck = status.kind === 'expired' && status.reason === 'offline';

  async function handleActivate(event: FormEvent) {
    event.preventDefault();
    if (!key) {
      setError('Lisans anahtarını yaz');
      keyRef.current?.focus();
      return;
    }
    setPending('activate');
    setError(null);
    try {
      await activate(key);
    } catch (activateError) {
      setError(errorMessage(activateError));
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
    <div {...props(styles.screen)}>
      <DragRegion />
      <div {...props(styles.column)}>
        <div {...props(styles.header)}>
          <Wordmark style={styles.wordmark} />
          <div {...props(styles.copy)}>
            <h1 {...props(styles.title)}>{copy.title}</h1>
            <p {...props(styles.description)}>{copy.description}</p>
          </div>
        </div>
        {needsOnlineCheck ? (
          <Button
            disabled={pending !== null}
            focusableWhenDisabled
            onClick={() => void handleRetry()}
            style={styles.wide}
          >
            {pending === 'check' ? 'Doğrulanıyor…' : 'Tekrar dene'}
          </Button>
        ) : (
          <form onSubmit={handleActivate} {...props(styles.form)}>
            <Input
              aria-describedby={message ? 'license-error' : undefined}
              aria-invalid={error ? true : undefined}
              aria-label="Lisans anahtarı"
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              // The one field on a screen the app opens to.
              autoFocus
              id="license-key"
              onChange={(event) => {
                setKey(normalizeLicenseKey(event.target.value));
                setError(null);
              }}
              placeholder="ANGARIA-…"
              ref={keyRef}
              spellCheck={false}
              value={key}
            />
            <Button
              disabled={pending !== null}
              focusableWhenDisabled
              style={styles.wide}
              type="submit"
            >
              {pending === 'activate' ? 'Etkinleştiriliyor…' : 'Etkinleştir'}
            </Button>
          </form>
        )}
        {message && (
          <p id="license-error" role="alert" {...props(styles.error)}>
            {message}
          </p>
        )}
        <div {...props(styles.links)}>
          <Button onClick={openCheckout} variant="link">
            {status.kind === 'unlicensed' ? '14 gün ücretsiz dene' : 'Abone ol'}
          </Button>
          {status.kind === 'expired' && status.reason === 'subscription' && (
            <Button onClick={openCustomerPortal} variant="link">
              Aboneliği yönet
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function GraceBanner({ daysLeft }: { daysLeft: number }) {
  return (
    <div {...props(styles.bannerWrap)}>
      <p role="status" {...props(styles.banner)}>
        <TriangleAlertIcon aria-hidden {...props(styles.bannerIcon)} />
        <span {...props(capStyles.text)}>
          {daysLeft > 0
            ? `Lisans sunucusuna ulaşılamadı. ${daysLeft} gün içinde doğrulanmazsa Angaria kilitlenir.`
            : 'Lisans sunucusuna ulaşılamadı. Bugün doğrulanmazsa Angaria kilitlenir.'}
        </span>
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
