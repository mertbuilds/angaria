import { Button, toast } from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { CopyIcon, LoaderCircleIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useRequireCredentials } from '@/shell/credentials-guard.tsx';
import {
  findCachedInvoice,
  PreviewTabStrip,
  useInvoicePreview,
  usePreviewTabs,
} from '@/shell/preview-tabs.tsx';
import { Screen } from '@/shell/screen.tsx';

export const Route = createFileRoute('/faturalar/$ettn')({
  component: InvoicePreviewRoute,
});

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

const styles = create({
  frame: {
    backgroundColor: '#ffffff',
    borderWidth: 0,
    flex: 1,
    width: '100%',
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
    height: '1.5rem',
    width: '1.5rem',
  },
  state: {
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    fontSize: font.sizeSm,
    gap: spacing.s3,
    justifyContent: 'center',
  },
});

function InvoicePreviewRoute() {
  const { ettn } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requireCredentials = useRequireCredentials();
  const { dismissTab, tabs } = usePreviewTabs();
  const invoice =
    tabs.find((tab) => tab.id === ettn)?.invoice ?? findCachedInvoice(queryClient, ettn);
  const preview = useInvoicePreview(invoice);

  // A failed load closes the tab and returns to the list. The failed query
  // stays cached, so opening the invoice again retries it (wait for that retry).
  const failure = preview.isFetching ? null : preview.error;
  useEffect(() => {
    if (failure) {
      toast.error(failure instanceof Error ? failure.message : 'Bilinmeyen hata');
      dismissTab(ettn);
      void navigate({ replace: true, to: '/faturalar' });
    }
  }, [dismissTab, ettn, failure, navigate]);

  const useAsTemplate = () => {
    if (requireCredentials()) {
      void navigate({ search: { kaynak: ettn }, to: '/yeni' });
    }
  };

  let content;
  if (preview.data) {
    // sandbox="": GİB's HTML renders with no scripts, forms, plugins or
    // same-origin access to the app.
    content = (
      <iframe sandbox="" srcDoc={preview.data} title="Fatura önizleme" {...props(styles.frame)} />
    );
  } else if (invoice && preview.isFetching) {
    content = (
      <div {...props(styles.state)}>
        <LoaderCircleIcon aria-label="Yükleniyor" {...props(styles.spinner)} />
      </div>
    );
  } else {
    content = (
      <div {...props(styles.state)}>
        <p>Bu faturanın önizlemesi açık değil.</p>
        <Button render={<Link to="/faturalar" />} variant="outline">
          Faturalara dön
        </Button>
      </div>
    );
  }

  return (
    <Screen
      actions={
        preview.data && (
          <Button onClick={useAsTemplate} variant="outline">
            <CopyIcon />
            Şablon olarak kullan
          </Button>
        )
      }
      scroll={false}
      title="Faturalar"
      toolbar={<PreviewTabStrip />}
    >
      {content}
    </Screen>
  );
}
