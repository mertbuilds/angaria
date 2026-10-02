import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, keyframes, props, type StyleXStyles } from '@stylexjs/stylex';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ChevronDownIcon,
  DownloadIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  RepeatIcon,
  Trash2Icon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cancelInvoice } from '@/lib/angaria.ts';
import { UNNAMED_CUSTOMER } from '@/lib/copy.ts';
import { defaultPDFLanguage, findCustomer } from '@/lib/customer.ts';
import { fetchForeground } from '@/lib/foreground-fetch.ts';
import {
  cachedInvoices,
  gib,
  invoiceDetailQuery,
  invoiceHTMLQuery,
  invoiceListQuery,
  useGIBAccount,
} from '@/lib/gib.ts';
import { dueDateOf } from '@/lib/invoice-due-dates.ts';
import { readQRValue } from '@/lib/invoice-preview.ts';
import { invoiceStatus, parseGIBInvoice } from '@/lib/invoices.ts';
import { useStore } from '@/lib/store.tsx';
import type { Invoice, PDFLanguage } from '@/lib/types.ts';
import { formatDateHuman } from '@/lib/utils.ts';
import { useRequireCredentials } from '@/shell/credentials-guard.tsx';
import { ErrorState } from '@/shell/error-state.tsx';
import { EmptyState, formatMoney } from '@/shell/searchable-list.tsx';
import { useSMSSign } from './use-sms-sign.tsx';

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

const styles = create({
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  frame: {
    borderWidth: 0,
    display: 'block',
    insetBlockStart: 0,
    insetInlineStart: 0,
    position: 'absolute',
    transformOrigin: '0 0',
  },
  // GİB's page is paper: white, with light form controls, in both themes.
  frameBox: {
    backgroundColor: '#ffffff',
    colorScheme: 'light',
    flex: 1,
    minHeight: '32rem',
    overflow: 'hidden',
    position: 'relative',
  },
  frameSize: (width: number, height: number, scale: number) => ({
    height: `${height}px`,
    transform: `scale(${scale})`,
    width: `${width}px`,
  }),
  // The menu trigger carries its own data-slot, so the theme's button icon
  // size does not reach its icon.
  icon: {
    flexShrink: 0,
    height: '1rem',
    width: '1rem',
  },
  header: {
    borderBottomColor: colors.border,
    borderBottomStyle: 'solid',
    borderBottomWidth: '1px',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    gap: spacing.s4,
    padding: spacing.s6,
  },
  meta: {
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: font.sizeSm,
    fontVariantNumeric: 'tabular-nums',
    gap: spacing.s2,
    margin: 0,
  },
  root: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
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
  splitMain: {
    borderEndEndRadius: 0,
    borderStartEndRadius: 0,
  },
  splitMenu: {
    borderEndStartRadius: 0,
    borderStartStartRadius: 0,
    marginInlineStart: '1px',
  },
  splitWrap: {
    display: 'inline-flex',
  },
  state: {
    alignItems: 'center',
    display: 'flex',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.s8,
  },
  title: {
    color: colors.fg,
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
    lineHeight: 1.25,
    margin: 0,
    overflowWrap: 'anywhere',
  },
  titleBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    minWidth: 0,
  },
});

const PDF_LANGUAGE_NAMES: Record<PDFLanguage, string> = {
  both: 'Türkçe ve İngilizce',
  en: 'İngilizce',
  tr: 'Türkçe',
};

// GİB lays the invoice out 800px wide. A narrower pane shows the whole page
// scaled down rather than cutting off the QR code and the totals.
const PAGE_WIDTH = 840;

/**
 * GİB's HTML in `<iframe sandbox="">`: no scripts, forms, plugins or
 * same-origin access to the app. `style` sizes the box (32rem high at least
 * by default); the page scales to its width.
 */
export function InvoiceFrame({ html, style }: { html: string; style?: StyleXStyles }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ height: number; width: number } | null>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setSize({ height: entry.contentRect.height, width: entry.contentRect.width });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = size ? Math.min(1, size.width / PAGE_WIDTH) : 1;
  return (
    <div ref={box} {...props(styles.frameBox, style)}>
      {size && (
        <iframe
          sandbox=""
          srcDoc={html}
          title="Fatura önizlemesi"
          {...props(
            styles.frame,
            styles.frameSize(scale < 1 ? PAGE_WIDTH : size.width, size.height / scale, scale),
          )}
        />
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div {...props(styles.state)}>
      <LoaderCircleIcon aria-label="Yükleniyor" role="status" {...props(styles.spinner)} />
    </div>
  );
}

/** PDF indir in the customer's language, the other one from the menu. */
function PDFButton({
  defaultLanguage,
  disabled,
  onDownload,
}: {
  defaultLanguage: PDFLanguage;
  disabled: boolean;
  onDownload: (language: PDFLanguage) => void;
}) {
  return (
    <div role="group" {...props(styles.splitWrap)}>
      <Button
        disabled={disabled}
        onClick={() => onDownload(defaultLanguage)}
        style={styles.splitMain}
      >
        <DownloadIcon />
        PDF indir ({PDF_LANGUAGE_NAMES[defaultLanguage]})
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          render={<Button aria-label="PDF dilini seç" size="icon" style={styles.splitMenu} />}
        >
          <ChevronDownIcon {...props(styles.icon)} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(['tr', 'en', 'both'] as const).map((language) => (
            <DropdownMenuItem key={language} onClick={() => onDownload(language)}>
              PDF indir ({PDF_LANGUAGE_NAMES[language]})
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * GİB's own rendering of the invoice (QR code drawn in), under its actions:
 * SMS ile onayla and Sil for drafts, PDF indir for signed invoices, Tekrar kes
 * for all.
 */
function InvoicePane({ invoice }: { invoice: Invoice & { ettn: string } }) {
  const { ettn } = invoice;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requireCredentials = useRequireCredentials();
  const account = useGIBAccount();
  const { activeEntity, companyInfo, savedRecipients } = useStore();
  const status = invoiceStatus(invoice.onayDurumu);
  const preview = useQuery(invoiceHTMLQuery(account, ettn, invoice.onayDurumu ?? ''));
  const total = useQuery({
    ...invoiceDetailQuery(account, ettn, true),
    enabled: status.filter !== 'iptal',
    select: parseGIBInvoice,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const sms = useSMSSign();

  const defaultLanguage = defaultPDFLanguage(
    findCustomer(savedRecipients, invoice.aliciVknTckn ?? '', invoice.aliciUnvanAdSoyad ?? '') ?? {
      country: total.data?.recipient.country ?? '',
      taxIDOrTRID: invoice.aliciVknTckn ?? '',
    },
  );

  // The header's total may be fetching the same detail in the background.
  const readDetail = async () =>
    parseGIBInvoice(await fetchForeground(queryClient, invoiceDetailQuery(account, ettn)));
  const refreshList = () => queryClient.invalidateQueries({ queryKey: ['invoices', account.key] });

  const pdf = useMutation({
    mutationFn: async (language: PDFLanguage) => {
      toast.loading('PDF hazırlanıyor…', { id: `pdf-${ettn}` });
      const { items, note, recipient, settings, subtotal, vat } = await readDetail();
      // The QR code's text sits in GİB's preview, which the pane shows already.
      const html = await queryClient.fetchQuery(
        invoiceHTMLQuery(account, ettn, invoice.onayDurumu ?? ''),
      );
      // react-pdf is large, so it loads with the first PDF.
      const { downloadInvoicePDF } = await import('@/components/invoice-pdf.tsx');
      await downloadInvoicePDF({
        company: companyInfo,
        date: invoice.belgeTarihi ?? '',
        dueDate: dueDateOf(ettn),
        entityName: activeEntity.name,
        ettn,
        gibNumber: invoice.belgeNumarasi,
        grandTotal: subtotal,
        items: items.map((item, index) => ({ ...item, id: String(index) })),
        language,
        note,
        qrValue: readQRValue(html),
        recipient: { ...recipient, id: '' },
        settings,
        total: subtotal + vat,
        totalVAT: vat,
      });
    },
    // Errors get the app-wide toast; this one only replaces the spinner.
    onError: () => toast.dismiss(`pdf-${ettn}`),
    onSuccess: () => toast.success('PDF indirildi', { id: `pdf-${ettn}` }),
  });

  const remove = useMutation({
    mutationFn: () =>
      gib.run(account, (session) =>
        cancelInvoice(
          session,
          'Fatura iptal edildi',
          invoice as unknown as Record<string, unknown>,
        ),
      ),
    onSuccess: () => {
      toast.success('Taslak silindi');
      void refreshList();
    },
  });

  // Pending until the SMS dialog closes. Null: the pane closed first.
  const startSign = useMutation({
    mutationFn: () => sms.sign(async () => ({ ettns: [ettn], value: null })),
    onSuccess: (result) => {
      if (result?.signed) {
        toast.success('Fatura onaylandı');
        void refreshList();
      }
    },
  });

  const guarded = (action: () => void) => () => {
    if (requireCredentials()) {
      action();
    }
  };

  const busy = pdf.isPending || remove.isPending || startSign.isPending;

  let body;
  if (preview.data) {
    body = <InvoiceFrame html={preview.data} />;
  } else if (preview.isError) {
    body = (
      <ErrorState
        error={preview.error}
        onRetry={() => void preview.refetch()}
        title="Önizleme alınamadı"
      />
    );
  } else {
    body = <Spinner />;
  }

  return (
    <div {...props(styles.root)}>
      <header {...props(styles.header)}>
        <div {...props(styles.titleBlock)}>
          <h2 {...props(styles.title)}>{invoice.aliciUnvanAdSoyad || UNNAMED_CUSTOMER}</h2>
          <p {...props(styles.meta)}>
            {[
              invoice.belgeNumarasi,
              formatDateHuman(invoice.belgeTarihi ?? ''),
              total.data && formatMoney(total.data.total, total.data.settings.currency),
            ]
              .filter(Boolean)
              .join(' · ')}
            <Badge variant={status.variant}>{status.label}</Badge>
          </p>
        </div>
        <div {...props(styles.actions)}>
          {status.filter === 'onaylanmadi' && (
            <Button disabled={busy} onClick={guarded(() => startSign.mutate())}>
              <MessageSquareIcon />
              {sms.sending ? 'SMS gönderiliyor…' : 'SMS ile onayla'}
            </Button>
          )}
          {status.filter === 'onaylandi' && (
            <PDFButton
              defaultLanguage={defaultLanguage}
              disabled={busy}
              onDownload={(language) => guarded(() => pdf.mutate(language))()}
            />
          )}
          <Button
            disabled={busy}
            onClick={guarded(() => void navigate({ search: { kaynak: ettn }, to: '/yeni' }))}
            variant="outline"
          >
            <RepeatIcon />
            Tekrar kes
          </Button>
          {status.filter === 'onaylanmadi' && (
            <Button disabled={busy} onClick={() => setDeleteOpen(true)} variant="destructive">
              <Trash2Icon />
              Sil
            </Button>
          )}
        </div>
      </header>

      {body}

      {sms.dialog}

      <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taslak silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {invoice.belgeNumarasi
                ? `${invoice.belgeNumarasi} numaralı taslak GİB’den silinir.`
                : 'Bu taslak GİB’den silinir.'}{' '}
              Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={guarded(() => remove.mutate())} variant="destructive">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** /faturalar/$ettn: the invoice from the list the screen shows, or any list fetched this session. */
export function InvoiceDetail({ ettn }: { ettn: string }) {
  const queryClient = useQueryClient();
  const account = useGIBAccount();
  const { hasCredentials, invoiceDateRange } = useStore();
  const list = useQuery({
    ...invoiceListQuery(account, invoiceDateRange),
    enabled: hasCredentials,
  });
  const invoice =
    list.data?.find((row) => row.ettn === ettn) ??
    cachedInvoices(queryClient, account).find((row) => row.ettn === ettn);

  if (invoice?.ettn) {
    return <InvoicePane invoice={{ ...invoice, ettn: invoice.ettn }} key={invoice.ettn} />;
  }
  if (list.isPending) {
    return <Spinner />;
  }
  return (
    <EmptyState
      action={
        <Button render={<Link to="/faturalar" />} variant="outline">
          Faturalara dön
        </Button>
      }
      title="Fatura bulunamadı"
    >
      Bu fatura seçili tarih aralığında yok. Tarih aralığını değiştirip yeniden aç.
    </EmptyState>
  );
}

/** /faturalar with nothing open. */
export function NoInvoiceOpen() {
  return (
    <EmptyState title="Bir fatura seç">
      Listeden bir faturaya tıkla ya da ok tuşlarıyla seçip Enter’a bas. Önizleme, SMS onayı ve PDF
      burada açılır.
    </EmptyState>
  );
}
