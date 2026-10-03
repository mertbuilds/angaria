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
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  SplitButton,
  toast,
} from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, keyframes, props, type StyleXStyles } from '@stylexjs/stylex';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  DownloadIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  RepeatIcon,
  Trash2Icon,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { cancelInvoice, downloadInvoice } from '@/lib/angaria.ts';
import { UNNAMED_CUSTOMER } from '@/lib/copy.ts';
import { defaultPDFLanguage, findCustomer } from '@/lib/customer.ts';
import { toastDownloaded, toastPreparing } from '@/lib/download-toast.tsx';
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
import { buildEArchiveFilename } from '@/lib/invoice-pdf-i18n.ts';
import { readQRValue } from '@/lib/invoice-preview.ts';
import { PAGE_WIDTH } from '@/lib/invoice-zoom.ts';
import { invoiceStatus, parseGIBInvoice } from '@/lib/invoices.ts';
import { htmlToPDF } from '@/lib/native.ts';
import { saveFile } from '@/lib/save-file.ts';
import { useStore } from '@/lib/store.tsx';
import type { Invoice, PDFLanguage } from '@/lib/types.ts';
import { formatDateHuman } from '@/lib/utils.ts';
import { useRequireCredentials } from '@/shell/credentials-guard.tsx';
import { ErrorState } from '@/shell/error-state.tsx';
import { EmptyState, formatMoney } from '@/shell/searchable-list.tsx';
import { tones } from '../shell/palette.stylex.ts';
import {
  InvoicePaper,
  InvoiceViewer,
  PaperBar,
  paperStyles,
  usePaperZoom,
  useZoomKeys,
} from './invoice-viewer.tsx';
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
  // GİB's page is paper: white, with light form controls, in both themes;
  // dark palettes dim it a little so it does not glare.
  frameBox: {
    backgroundColor: '#ffffff',
    colorScheme: 'light',
    filter: tones.paperFilter,
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
  header: {
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
  // The page lies on the canvas under the header and scrolls there; the zoom
  // bar floats over its foot.
  preview: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
    position: 'relative',
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

/**
 * GİB's HTML in `<iframe sandbox="">`: no scripts, forms, plugins or
 * same-origin access to the app. `style` sizes the box (32rem high at least
 * by default); the page scales to its width (never past actual size, GİB lays
 * it out 800px wide). Yeni fatura's thumbnail; the detail pane zooms with
 * InvoicePaper.
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

type EArchiveFile = 'pdf' | 'zip';

/**
 * İndir: GİB's own document (e-Arşiv faturası: the PDF of GİB's page, GİB's
 * zip) and the Angaria PDF (Minimal or Klasik, in a language). The button
 * downloads the Angaria PDF in the customer's language, or the e-Arşiv PDF
 * where there is no Angaria PDF (a cancelled invoice).
 */
function DownloadMenu({
  angaria,
  disabled,
  onAngaria,
  onEArchive,
}: {
  /** The customer's language; null offers GİB's document only. */
  angaria: PDFLanguage | null;
  disabled: boolean;
  onAngaria: (language: PDFLanguage) => void;
  onEArchive: (file: EArchiveFile) => void;
}) {
  const eArchiveLabel = useId();
  const angariaLabel = useId();
  return (
    <SplitButton
      disabled={disabled}
      menu={
        <DropdownMenuContent align="end">
          <DropdownMenuGroup aria-labelledby={eArchiveLabel}>
            <DropdownMenuLabel id={eArchiveLabel}>e-Arşiv faturası (GİB)</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onEArchive('pdf')}>e-Arşiv PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEArchive('zip')}>HTML/ZIP (GİB)</DropdownMenuItem>
          </DropdownMenuGroup>
          {angaria && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup aria-labelledby={angariaLabel}>
                <DropdownMenuLabel id={angariaLabel}>Angaria PDF</DropdownMenuLabel>
                {(['tr', 'en', 'both'] as const).map((language) => (
                  <DropdownMenuItem key={language} onClick={() => onAngaria(language)}>
                    {PDF_LANGUAGE_NAMES[language]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      }
      menuLabel="İndirme seçenekleri"
      onClick={() => (angaria ? onAngaria(angaria) : onEArchive('pdf'))}
    >
      <DownloadIcon />
      {angaria ? `Angaria PDF (${PDF_LANGUAGE_NAMES[angaria]})` : 'e-Arşiv PDF'}
    </SplitButton>
  );
}

/**
 * GİB's own rendering of the invoice (QR code drawn in), under its actions:
 * SMS ile onayla and Sil for drafts, the downloads for signed and cancelled
 * invoices, Tekrar kes for all. The page zooms (⌘+, ⌘-, ⌘0, pinch) and opens
 * full screen on a click, Tam ekran or Space.
 */
function InvoicePane({ invoice }: { invoice: Invoice & { ettn: string } }) {
  const { ettn } = invoice;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requireCredentials = useRequireCredentials();
  const account = useGIBAccount();
  const { activeEntity, companyInfo, savedRecipients } = useStore();
  const status = invoiceStatus(invoice);
  // GİB shows no page for a deleted draft.
  const deleted = status.filter === 'silindi';
  const preview = useQuery({
    ...invoiceHTMLQuery(account, ettn, invoice.onayDurumu ?? ''),
    enabled: !deleted,
  });
  const total = useQuery({
    ...invoiceDetailQuery(account, ettn, true),
    enabled: !deleted,
    select: parseGIBInvoice,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const sms = useSMSSign();
  const zoom = usePaperZoom();
  useZoomKeys(zoom, Boolean(preview.data));

  // Space opens the page full screen, as Quick Look does, from the list or
  // the pane; fields, buttons and menus keep their own Space.
  const hasPreview = Boolean(preview.data);
  useEffect(() => {
    if (!hasPreview) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as Element | null;
      if (
        event.key !== ' ' ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.isComposing ||
        event.defaultPrevented ||
        (target !== document.body && !target?.matches?.('[role="listbox"]')) ||
        document.querySelector('[role="dialog"], [role="alertdialog"]')
      ) {
        return;
      }
      event.preventDefault();
      setViewerOpen(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [hasPreview]);

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
      toastPreparing('PDF hazırlanıyor…', `pdf-${ettn}`);
      const { items, note, recipient, settings, subtotal, vat } = await readDetail();
      // The QR code's text sits in GİB's preview, which the pane shows already.
      const html = await queryClient.fetchQuery(
        invoiceHTMLQuery(account, ettn, invoice.onayDurumu ?? ''),
      );
      // react-pdf is large, so it loads with the first PDF.
      const { downloadInvoicePDF } = await import('@/components/invoice-pdf.tsx');
      return downloadInvoicePDF({
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
    onSuccess: (file) => toastDownloaded(`pdf-${ettn}`, 'PDF kaydedildi', file),
  });

  const eArchive = useMutation({
    mutationFn: async (file: EArchiveFile) => {
      toastPreparing(
        file === 'pdf' ? 'e-Arşiv PDF hazırlanıyor…' : 'e-Arşiv faturası kaydediliyor…',
        `earsiv-${ettn}`,
      );
      const filename = buildEArchiveFilename(
        {
          companyName: companyInfo.name,
          date: invoice.belgeTarihi ?? '',
          entityName: activeEntity.name,
          gibNumber: invoice.belgeNumarasi,
          recipientTitle: invoice.aliciUnvanAdSoyad ?? '',
        },
        file,
      );
      if (file === 'zip') {
        const zip = await gib.run(account, (session) =>
          downloadInvoice(session, ettn, invoice.onayDurumu ?? ''),
        );
        return saveFile(new Blob([zip], { type: 'application/zip' }), filename);
      }
      // The page the pane shows: GİB's HTML, QR code drawn in, no scripts.
      const html = await queryClient.fetchQuery(
        invoiceHTMLQuery(account, ettn, invoice.onayDurumu ?? ''),
      );
      return saveFile(new Blob([await htmlToPDF(html)], { type: 'application/pdf' }), filename);
    },
    onError: () => toast.dismiss(`earsiv-${ettn}`),
    onSuccess: (file) => toastDownloaded(`earsiv-${ettn}`, 'e-Arşiv faturası kaydedildi', file),
  });

  const remove = useMutation({
    mutationFn: () =>
      gib.run(account, (session) =>
        cancelInvoice(session, 'Taslak silindi', invoice as unknown as Record<string, unknown>),
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

  const busy = pdf.isPending || eArchive.isPending || remove.isPending || startSign.isPending;
  const title = invoice.aliciUnvanAdSoyad || UNNAMED_CUSTOMER;

  const downloads = (status.filter === 'onaylandi' || status.filter === 'iptal') && (
    <DownloadMenu
      angaria={status.filter === 'onaylandi' ? defaultLanguage : null}
      disabled={busy}
      onAngaria={(language) => guarded(() => pdf.mutate(language))()}
      onEArchive={(file) => guarded(() => eArchive.mutate(file))()}
    />
  );

  let body;
  if (deleted) {
    body = (
      <EmptyState title="Bu taslak silinmiş">
        GİB silinen taslakların önizlemesini göstermez.
      </EmptyState>
    );
  } else if (preview.data) {
    body = (
      <div {...props(styles.preview)}>
        <InvoicePaper
          html={preview.data}
          onOpen={() => setViewerOpen(true)}
          style={paperStyles.underBar}
          zoom={zoom}
        />
        <PaperBar onOpen={() => setViewerOpen(true)} zoom={zoom} />
        <InvoiceViewer
          downloads={downloads}
          html={preview.data}
          onOpenChange={setViewerOpen}
          open={viewerOpen}
          title={[title, invoice.belgeNumarasi].filter(Boolean).join(' · ')}
        />
      </div>
    );
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
          <h2 {...props(styles.title)}>{title}</h2>
          <p {...props(styles.meta)}>
            {[
              invoice.belgeNumarasi,
              formatDateHuman(invoice.belgeTarihi ?? ''),
              total.data && formatMoney(total.data.total, total.data.settings.currency),
              status.hint,
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
          {downloads}
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
