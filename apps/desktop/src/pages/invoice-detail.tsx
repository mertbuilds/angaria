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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  FieldLabel,
  Input,
  toast,
} from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, keyframes, props, type StyleXStyles } from '@stylexjs/stylex';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  BookmarkPlusIcon,
  ChevronDownIcon,
  DownloadIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  RepeatIcon,
  Trash2Icon,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { downloadInvoicePDF } from '@/components/invoice-pdf.tsx';
import { cancelInvoice, startSMSSign, verifyAndSign } from '@/lib/angaria.ts';
import {
  cachedInvoices,
  gib,
  invoiceDetailQuery,
  invoiceHTMLQuery,
  invoiceListQuery,
  useGIBAccount,
} from '@/lib/gib.ts';
import { resolvePDFLanguage } from '@/lib/invoice-pdf-i18n.ts';
import { invoiceStatus, parseGIBInvoice, type GIBInvoice } from '@/lib/invoices.ts';
import type { SessionLease } from '@/lib/session-queue.ts';
import { useStore } from '@/lib/store.tsx';
import type { Invoice, PDFLanguage } from '@/lib/types.ts';
import { formatDateHuman } from '@/lib/utils.ts';
import { useRequireCredentials } from '@/shell/credentials-guard.tsx';
import { EmptyState, formatMoney } from '@/shell/searchable-list.tsx';
import { errorMessage } from './invoices.tsx';

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
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  frame: {
    borderWidth: 0,
    display: 'block',
    insetBlockStart: 0,
    insetInlineStart: 0,
    position: 'absolute',
    transformOrigin: '0 0',
  },
  frameBox: {
    backgroundColor: '#ffffff',
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

const PDF_LANGUAGE_NAMES: Record<PDFLanguage, string> = { en: 'İngilizce', tr: 'Türkçe' };

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
          title="Fatura önizleme"
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
          {(['tr', 'en'] as const).map((language) => (
            <DropdownMenuItem key={language} onClick={() => onDownload(language)}>
              PDF indir ({PDF_LANGUAGE_NAMES[language]})
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TemplateNameForm({
  initialName,
  onSave,
}: {
  initialName: string;
  onSave: (name: string) => void;
}) {
  const id = useId();
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) {
          onSave(trimmed);
        }
      }}
      {...props(styles.form)}
    >
      <DialogHeader>
        <DialogTitle>Şablon olarak kaydet</DialogTitle>
        <DialogDescription>
          Müşteri, kalemler ve not şablona kopyalanır. Şablonlar’dan tek adımda yeni fatura
          kesersiniz.
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor={`${id}-name`}>Şablon adı</FieldLabel>
        <Input
          autoFocus
          id={`${id}-name`}
          onChange={(event) => setName(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          value={name}
        />
      </Field>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Vazgeç</DialogClose>
        <Button disabled={!trimmed} type="submit">
          Kaydet
        </Button>
      </DialogFooter>
    </form>
  );
}

function SMSCodeForm({
  onVerify,
  pending,
  phone,
}: {
  onVerify: (code: string) => void;
  pending: boolean;
  phone: string;
}) {
  const id = useId();
  const [code, setCode] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim() && !pending) {
      onVerify(code.trim());
      setCode('');
    }
  };

  return (
    <form onSubmit={submit} {...props(styles.form)}>
      <DialogHeader>
        <DialogTitle>SMS ile onayla</DialogTitle>
        <DialogDescription>
          {phone} numarasına gönderilen kodu girin. Onaylanan fatura kesinleşir.
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor={`${id}-code`}>SMS kodu</FieldLabel>
        <Input
          autoComplete="one-time-code"
          autoFocus
          id={`${id}-code`}
          inputMode="numeric"
          onChange={(event) => setCode(event.target.value)}
          value={code}
        />
      </Field>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Vazgeç</DialogClose>
        <Button disabled={!code.trim() || pending} type="submit">
          {pending ? 'Onaylanıyor...' : 'Onayla'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * GİB's own rendering of the invoice (QR code drawn in), under its actions:
 * SMS ile onayla and Sil for drafts, PDF indir for signed invoices, Tekrar kes
 * and Şablon olarak kaydet for all.
 */
function InvoicePane({ invoice }: { invoice: Invoice & { ettn: string } }) {
  const { ettn } = invoice;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requireCredentials = useRequireCredentials();
  const account = useGIBAccount();
  const { activeEntity, companyInfo, newId, savedRecipients, setInvoiceTemplates } = useStore();
  const status = invoiceStatus(invoice.onayDurumu);
  const preview = useQuery(invoiceHTMLQuery(account, ettn, invoice.onayDurumu ?? ''));
  const total = useQuery({
    ...invoiceDetailQuery(account, ettn, true),
    enabled: status.filter !== 'iptal',
    select: parseGIBInvoice,
  });
  const [templateDraft, setTemplateDraft] = useState<GIBInvoice | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [smsPhone, setSmsPhone] = useState<string | null>(null);
  const sms = useRef<{ lease: SessionLease; oid: string } | null>(null);

  const defaultLanguage = resolvePDFLanguage(
    savedRecipients.find((customer) => customer.taxIDOrTRID === invoice.aliciVknTckn)?.pdfLanguage,
  );

  const readDetail = async () =>
    parseGIBInvoice(await queryClient.fetchQuery(invoiceDetailQuery(account, ettn)));
  const refreshList = () => queryClient.invalidateQueries({ queryKey: ['invoices', account.key] });

  const pdf = useMutation({
    mutationFn: async (language: PDFLanguage) => {
      toast.loading('PDF hazırlanıyor...', { id: `pdf-${ettn}` });
      const { items, note, recipient, settings, subtotal, vat } = await readDetail();
      await downloadInvoicePDF({
        company: companyInfo,
        date: invoice.belgeTarihi ?? '',
        entityName: activeEntity.name,
        grandTotal: subtotal,
        invoiceNumber: invoice.belgeNumarasi,
        items: items.map((item, index) => ({ ...item, id: String(index) })),
        language,
        note,
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

  const template = useMutation({
    mutationFn: readDetail,
    onSuccess: setTemplateDraft,
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

  const releaseSMS = (error?: unknown) => {
    sms.current?.lease.release(error);
    sms.current = null;
  };

  const startSign = useMutation({
    mutationFn: async () => {
      const lease = await gib.lease(account);
      try {
        const { oid, phone } = await startSMSSign(lease.session);
        sms.current = { lease, oid };
        return phone;
      } catch (error) {
        lease.release(error);
        throw error;
      }
    },
    onSuccess: setSmsPhone,
  });

  const verify = useMutation({
    mutationFn: (code: string) => {
      const current = sms.current;
      if (!current) {
        throw new Error('SMS oturumu kapandı, onayı yeniden başlatın.');
      }
      return verifyAndSign(current.lease.session, code, current.oid, [ettn]);
    },
    onSuccess: () => {
      releaseSMS();
      setSmsPhone(null);
      toast.success('Fatura onaylandı');
      void refreshList();
    },
  });

  // Leaving the invoice mid-signing hands the GİB session back.
  useEffect(() => () => sms.current?.lease.release(), []);

  const guarded = (action: () => void) => () => {
    if (requireCredentials()) {
      action();
    }
  };

  const busy = pdf.isPending || template.isPending || remove.isPending || startSign.isPending;

  let body;
  if (preview.data) {
    body = <InvoiceFrame html={preview.data} />;
  } else if (preview.isError) {
    body = (
      <EmptyState
        action={
          <Button onClick={() => void preview.refetch()} variant="outline">
            Tekrar dene
          </Button>
        }
        title="Önizleme alınamadı"
      >
        {errorMessage(preview.error)}
      </EmptyState>
    );
  } else {
    body = <Spinner />;
  }

  return (
    <div {...props(styles.root)}>
      <header {...props(styles.header)}>
        <div {...props(styles.titleBlock)}>
          <h2 {...props(styles.title)}>{invoice.aliciUnvanAdSoyad || 'Alıcı belirtilmedi'}</h2>
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
              {startSign.isPending ? 'SMS gönderiliyor...' : 'SMS ile onayla'}
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
            onClick={guarded(() => void navigate({ search: { kaynak: ettn }, to: '/yeni' }))}
            variant="outline"
          >
            <RepeatIcon />
            Tekrar kes
          </Button>
          <Button disabled={busy} onClick={guarded(() => template.mutate())} variant="outline">
            <BookmarkPlusIcon />
            Şablon olarak kaydet
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

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSmsPhone(null);
            releaseSMS();
          }
        }}
        open={smsPhone !== null}
      >
        <DialogContent showCloseButton={false}>
          {smsPhone !== null && (
            <SMSCodeForm
              onVerify={(code) => verify.mutate(code)}
              pending={verify.isPending}
              phone={smsPhone}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setTemplateDraft(null)}
        open={templateDraft !== null}
      >
        <DialogContent showCloseButton={false}>
          {templateDraft && (
            <TemplateNameForm
              initialName={templateDraft.recipient.title || invoice.aliciUnvanAdSoyad || ''}
              onSave={(name) => {
                const { items, note, recipient, settings } = templateDraft;
                setInvoiceTemplates((prev) => [
                  ...prev,
                  {
                    id: newId(),
                    items: items.map((item) => ({ ...item, id: newId() })),
                    name,
                    note,
                    recipient: { ...recipient, id: newId() },
                    settings,
                  },
                ]);
                setTemplateDraft(null);
                toast.success('Fatura şablonu kaydedildi', {
                  action: {
                    label: 'Şablonlara git',
                    onClick: () => void navigate({ search: {}, to: '/sablonlar' }),
                  },
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taslak silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {invoice.belgeNumarasi ?? 'Bu'} numaralı taslak GİB’den silinir. Bu işlem geri
              alınamaz.
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
      Bu fatura seçili tarih aralığında yok. Aralığı değiştirip yeniden açın.
    </EmptyState>
  );
}

/** /faturalar with nothing open. */
export function NoInvoiceOpen() {
  return (
    <EmptyState title="Bir fatura seçin">
      Tıklayın ya da ok tuşlarıyla gidip Enter’a basın. GİB önizlemesi, onay ve PDF burada açılır.
    </EmptyState>
  );
}
