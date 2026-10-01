import { Button } from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  DownloadIcon,
  FilePlusIcon,
  LoaderCircleIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { PDFLanguageToggle } from '@/components/pdf-language-toggle.tsx';
import { invoiceTotals, paymentTotal } from '@/lib/invoice-form.ts';
import type { InvoiceFormValues, PDFLanguage } from '@/lib/types.ts';
import { formatDateHuman } from '@/lib/utils.ts';
import { formatMoney, formatNumber } from '@/shell/searchable-list.tsx';
import { InvoiceFrame } from './invoice-detail.tsx';
import type { InvoiceForm } from './use-invoice-form.ts';

const isMac = navigator.userAgent.includes('Mac');

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

const styles = create({
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  card: {
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    padding: spacing.s4,
  },
  divider: {
    borderTopColor: colors.border,
    borderTopStyle: 'solid',
    borderTopWidth: '1px',
    margin: 0,
  },
  full: {
    width: '100%',
  },
  heading: {
    alignItems: 'center',
    color: colors.fg,
    display: 'flex',
    fontSize: font.sizeMd,
    fontWeight: font.weightMedium,
    gap: spacing.s2,
    margin: 0,
  },
  headingIcon: {
    flexShrink: 0,
    height: '1.25rem',
    width: '1.25rem',
  },
  muted: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
  },
  note: {
    color: colors.muted,
    fontSize: font.sizeXs,
    lineHeight: 1.5,
    margin: 0,
  },
  offer: {
    backgroundColor: colors.subtle,
    borderRadius: radius.base,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    padding: spacing.s3,
  },
  pair: {
    display: 'grid',
    gap: spacing.s2,
    gridTemplateColumns: 'minmax(0, 1fr) auto',
  },
  pdfRow: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s2,
  },
  pdfLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: font.sizeSm,
  },
  shortcut: {
    fontVariantNumeric: 'tabular-nums',
    opacity: 0.6,
  },
  spinner: {
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: spin,
    },
    animationTimingFunction: 'linear',
  },
  // The top of the page: seller, recipient and the first rows.
  thumbFrame: {
    aspectRatio: '4 / 3',
    flex: 'none',
    minHeight: 0,
    pointerEvents: 'none',
  },
  thumbOpen: {
    backgroundColor: 'transparent',
    borderRadius: radius.base,
    borderWidth: 0,
    cursor: 'pointer',
    inset: 0,
    outline: {
      ':focus-visible': `2px solid ${colors.muted}`,
      default: 'none',
    },
    outlineOffset: '2px',
    padding: 0,
    position: 'absolute',
  },
  thumbnail: {
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    overflow: 'hidden',
    position: 'relative',
  },
  title: {
    color: colors.fg,
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    margin: 0,
  },
  totalLabel: {
    color: colors.fg,
  },
  totalRow: {
    alignItems: 'baseline',
  },
  totalValue: {
    color: colors.fg,
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
  },
  totals: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    margin: 0,
  },
  totalsRow: {
    color: colors.muted,
    display: 'flex',
    fontSize: font.sizeSm,
    gap: spacing.s3,
    justifyContent: 'space-between',
  },
  totalsValue: {
    color: colors.fg,
    fontVariantNumeric: 'tabular-nums',
    margin: 0,
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  warning: {
    color: colors.warning,
  },
});

function TotalsRow({
  children,
  label,
  strong = false,
}: {
  children: ReactNode;
  label: string;
  strong?: boolean;
}) {
  return (
    <div {...props(styles.totalsRow, strong && styles.totalRow)}>
      <dt {...props(strong && styles.totalLabel)}>{label}</dt>
      <dd {...props(styles.totalsValue, strong && styles.totalValue)}>{children}</dd>
    </div>
  );
}

function PDFRow({
  language,
  onDownload,
  onLanguageChange,
}: {
  language: PDFLanguage;
  onDownload: () => void;
  onLanguageChange: (language: PDFLanguage) => void;
}) {
  return (
    <div {...props(styles.pdfRow)}>
      <span {...props(styles.pdfLabel)}>PDF</span>
      <PDFLanguageToggle onChange={onLanguageChange} value={language} />
      <Button onClick={onDownload} variant="ghost">
        <DownloadIcon />
        İndir
      </Button>
    </div>
  );
}

/** "KDV (%20)" when every row has the same rate, else "KDV". */
function vatLabel(values: InvoiceFormValues) {
  const rates = new Set(values.items.map((item) => item.VATRate));
  const [rate] = rates;
  return rates.size === 1 && Number.isFinite(rate) ? `KDV (%${formatNumber(rate)})` : 'KDV';
}

export function SummaryPanel({
  form,
  onClear,
  onDownloadPDF,
  onPDFLanguageChange,
  onSaveTemplate,
  pdfLanguage,
  rate,
  values,
}: {
  form: InvoiceForm;
  onClear: () => void;
  onDownloadPDF: () => void;
  onPDFLanguageChange: (language: PDFLanguage) => void;
  onSaveTemplate: () => void;
  pdfLanguage: PDFLanguage;
  /** The parsed currency rate for a foreign currency, else null. */
  rate: number | null;
  values: InvoiceFormValues;
}) {
  const currency = values.invoiceSettings.currency;
  const totals = invoiceTotals(values.items);
  const payment = paymentTotal(values, totals.total);

  return (
    <section aria-label="Özet" {...props(styles.card)}>
      <h2 {...props(styles.title)}>Özet</h2>
      <dl {...props(styles.totals)}>
        <TotalsRow label="Ara toplam">{formatMoney(totals.gross, currency)}</TotalsRow>
        {totals.discount > 0 && (
          <TotalsRow label="İndirim">−{formatMoney(totals.discount, currency)}</TotalsRow>
        )}
        <TotalsRow label={vatLabel(values)}>{formatMoney(totals.vat, currency)}</TotalsRow>
        <hr {...props(styles.divider)} />
        <TotalsRow label="Genel toplam" strong>
          {formatMoney(totals.total, currency)}
        </TotalsRow>
        {rate !== null && rate > 0 && (
          <TotalsRow label="Türk lirası karşılığı">
            {formatMoney(totals.total * rate, 'TRY')}
          </TotalsRow>
        )}
        {payment !== totals.total && (
          <TotalsRow label="Ödenecek tutar">{formatMoney(payment, currency)}</TotalsRow>
        )}
      </dl>
      <PDFRow
        language={pdfLanguage}
        onDownload={onDownloadPDF}
        onLanguageChange={onPDFLanguageChange}
      />
      <div {...props(styles.actions)}>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              disabled={isSubmitting}
              onClick={() => void form.handleSubmit()}
              style={styles.full}
            >
              {isSubmitting ? (
                <>
                  <LoaderCircleIcon {...props(styles.spinner)} />
                  GİB’e gönderiliyor
                </>
              ) : (
                <>
                  Taslak oluştur
                  <span aria-hidden {...props(styles.shortcut)}>
                    {isMac ? '⌘↵' : 'Ctrl ↵'}
                  </span>
                </>
              )}
            </Button>
          )}
        </form.Subscribe>
        <div {...props(styles.pair)}>
          <Button onClick={onSaveTemplate} variant="outline">
            Şablon olarak kaydet
          </Button>
          <Button onClick={onClear} variant="ghost">
            Temizle
          </Button>
        </div>
      </div>
    </section>
  );
}

/** The top of GİB's rendering, scaled to the column; a click opens the invoice. */
function InvoiceThumbnail({ html, onOpen }: { html: string; onOpen: () => void }) {
  return (
    <div {...props(styles.thumbnail)}>
      <InvoiceFrame html={html} style={styles.thumbFrame} />
      <button
        aria-label="Faturayı aç"
        onClick={onOpen}
        type="button"
        {...props(styles.thumbOpen)}
      />
    </div>
  );
}

export interface CreatedDraft {
  date: string;
  /** GİB's rendering; missing when the draft could not be read back. */
  html?: string;
  /** Belge numarası, once GİB's draft list returned it. */
  number?: string;
  /** ETTN; empty when GİB's draft list did not show the new draft. */
  uuid: string;
}

export function SuccessPanel({
  created,
  offerTemplate,
  onDownloadPDF,
  onNewInvoice,
  onOpenInvoice,
  onPDFLanguageChange,
  onSaveTemplate,
  pdfLanguage,
}: {
  created: CreatedDraft;
  offerTemplate: boolean;
  onDownloadPDF: () => void;
  onNewInvoice: () => void;
  onOpenInvoice: () => void;
  onPDFLanguageChange: (language: PDFLanguage) => void;
  onSaveTemplate: () => void;
  pdfLanguage: PDFLanguage;
}) {
  const verified = Boolean(created.html);
  return (
    <section aria-live="polite" {...props(styles.card)}>
      <div>
        <h2 {...props(styles.heading)}>
          {verified ? (
            <CircleCheckIcon aria-hidden {...props(styles.headingIcon)} />
          ) : (
            <CircleAlertIcon aria-hidden {...props(styles.headingIcon, styles.warning)} />
          )}
          Taslak oluşturuldu
        </h2>
        <p {...props(styles.muted)}>
          {[created.number, formatDateHuman(created.date)].filter(Boolean).join(' · ')}
        </p>
      </div>
      {created.html ? (
        <InvoiceThumbnail html={created.html} onOpen={onOpenInvoice} />
      ) : (
        <p {...props(styles.muted)}>
          GİB taslağı kaydetti ama geri okunamadı. Faturalar listesinden kontrol edin.
        </p>
      )}
      <div {...props(styles.actions)}>
        <Button onClick={onOpenInvoice} style={styles.full}>
          {created.uuid ? 'Faturaya git' : 'Faturalara git'}
        </Button>
        <Button onClick={onNewInvoice} style={styles.full} variant="outline">
          <FilePlusIcon />
          Yeni fatura
        </Button>
      </div>
      <PDFRow
        language={pdfLanguage}
        onDownload={onDownloadPDF}
        onLanguageChange={onPDFLanguageChange}
      />
      {offerTemplate && (
        <div {...props(styles.offer)}>
          <p {...props(styles.muted)}>
            Bu faturayı her ay kesiyorsanız şablon olarak kaydedin. Bir dahaki sefere hazır gelir.
          </p>
          <Button onClick={onSaveTemplate} variant="outline">
            Şablon olarak kaydet
          </Button>
        </div>
      )}
      <p {...props(styles.note)}>Taslak GİB’de onay bekliyor. Faturalar’dan imzalayabilirsiniz.</p>
    </section>
  );
}
