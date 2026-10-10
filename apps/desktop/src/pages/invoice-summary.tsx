import { Button, capStyles, FieldWarning } from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  DownloadIcon,
  FilePlusIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
} from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { PDFLanguageToggle } from '@/components/pdf-language-toggle.tsx';
import { invoiceTotals, paymentTotal, roundKurus } from '@/lib/invoice-form.ts';
import { messageSource } from '@/lib/rule-sources.ts';
import type { InvoiceFormValues, PDFLanguage } from '@/lib/types.ts';
import { formatDateHuman } from '@/lib/utils.ts';
import { formatMoney, formatNumber } from '@/shell/searchable-list.tsx';
import { tones } from '../shell/palette.stylex.ts';
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
    backgroundColor: tones.card,
    borderRadius: radius.base,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    padding: spacing.s4,
  },
  divider: {
    borderTopColor: tones.divider,
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
    // Focused by script only, to carry focus over from the summary.
    outline: 'none',
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
      ':focus-visible': `1px solid ${tones.ring}`,
      default: 'none',
    },
    outlineOffset: '2px',
    padding: 0,
    position: 'absolute',
  },
  thumbnail: {
    borderRadius: radius.base,
    boxShadow: `0 0 0 1px ${tones.paperEdge}`,
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
  warnings: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
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

const DOWNLOAD_LABEL = 'PDF’i indir';

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
      <PDFLanguageToggle onChange={onLanguageChange} size="sm" value={language} />
      <Button aria-label={DOWNLOAD_LABEL} onClick={onDownload} variant="ghost">
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

function Pending() {
  return (
    <>
      <LoaderCircleIcon {...props(styles.spinner)} />
      GİB’e gönderiliyor…
    </>
  );
}

export function SummaryPanel({
  form,
  onClear,
  onDownloadPDF,
  onPDFLanguageChange,
  pdfLanguage,
  rate,
  signing,
  values,
  warnings,
}: {
  form: InvoiceForm;
  onClear: () => void;
  onDownloadPDF: () => void;
  onPDFLanguageChange: (language: PDFLanguage) => void;
  pdfLanguage: PDFLanguage;
  /** The parsed currency rate for a foreign currency, else null. */
  rate: number | null;
  /** true while a submit creates and signs (Oluştur ve onayla). */
  signing: boolean;
  values: InvoiceFormValues;
  /** Rules worth a second look (invoiceWarnings), each once; they never block. */
  warnings: ReadonlyArray<string>;
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
          <>
            <TotalsRow label="TL karşılığı">
              {formatMoney(roundKurus(totals.total * rate), 'TRY')}
            </TotalsRow>
            {totals.vat > 0 && (
              <TotalsRow label="KDV TL karşılığı">
                {formatMoney(roundKurus(totals.vat * rate), 'TRY')}
              </TotalsRow>
            )}
          </>
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
      {warnings.length > 0 && (
        <div {...props(styles.warnings)}>
          {warnings.map((warning) => (
            <FieldWarning key={warning} source={messageSource(warning)}>
              {warning}
            </FieldWarning>
          ))}
        </div>
      )}
      <div {...props(styles.actions)}>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <>
              <Button
                aria-keyshortcuts={isMac ? 'Meta+Enter' : 'Control+Enter'}
                disabled={isSubmitting}
                focusableWhenDisabled
                onClick={() => void form.handleSubmit({ sign: false })}
                style={styles.full}
              >
                {isSubmitting && !signing ? (
                  <Pending />
                ) : (
                  <>
                    Taslak oluştur
                    <span aria-hidden {...props(styles.shortcut)}>
                      {isMac ? '⌘↵' : 'Ctrl ↵'}
                    </span>
                  </>
                )}
              </Button>
              <div {...props(styles.pair)}>
                <Button
                  aria-keyshortcuts={isMac ? 'Meta+Shift+Enter' : 'Control+Shift+Enter'}
                  disabled={isSubmitting}
                  focusableWhenDisabled
                  onClick={() => void form.handleSubmit({ sign: true })}
                  variant="outline"
                >
                  {isSubmitting && signing ? (
                    <Pending />
                  ) : (
                    <>
                      <MessageSquareIcon />
                      Oluştur ve onayla
                      <span aria-hidden {...props(styles.shortcut)}>
                        {isMac ? '⌘⇧↵' : 'Ctrl ⇧ ↵'}
                      </span>
                    </>
                  )}
                </Button>
                <Button
                  disabled={isSubmitting}
                  focusableWhenDisabled
                  onClick={onClear}
                  variant="ghost"
                >
                  Temizle
                </Button>
              </div>
            </>
          )}
        </form.Subscribe>
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
  /** true once signed by SMS (Oluştur ve onayla). */
  signed?: boolean;
  /** ETTN; empty when GİB's draft list did not show the new draft. */
  uuid: string;
}

export function SuccessPanel({
  created,
  onDownloadPDF,
  onNewInvoice,
  onOpenInvoice,
  onPDFLanguageChange,
  pdfLanguage,
}: {
  created: CreatedDraft;
  onDownloadPDF: () => void;
  onNewInvoice: () => void;
  onOpenInvoice: () => void;
  onPDFLanguageChange: (language: PDFLanguage) => void;
  pdfLanguage: PDFLanguage;
}) {
  const verified = Boolean(created.html);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The summary and its button went away with the focus: the result takes it,
  // unless the user is already somewhere else.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body) {
        headingRef.current?.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <section aria-live="polite" {...props(styles.card)}>
      <div>
        <h2 ref={headingRef} tabIndex={-1} {...props(styles.heading)}>
          {verified ? (
            <CircleCheckIcon aria-hidden {...props(styles.headingIcon)} />
          ) : (
            <CircleAlertIcon aria-hidden {...props(styles.headingIcon, styles.warning)} />
          )}
          <span {...props(capStyles.text)}>
            {created.signed ? 'Fatura onaylandı' : 'Taslak oluşturuldu'}
          </span>
        </h2>
        <p {...props(styles.muted)}>
          {[created.number, formatDateHuman(created.date)].filter(Boolean).join(' · ')}
        </p>
      </div>
      {created.html ? (
        <InvoiceThumbnail html={created.html} onOpen={onOpenInvoice} />
      ) : (
        <p {...props(styles.muted)}>
          GİB taslağı kaydetti ama geri okunamadı. Faturalar’da kontrol et.
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
      {!created.signed && (
        <p {...props(styles.note)}>
          Taslak GİB’de onay bekliyor. Faturalar’dan SMS ile onaylayabilirsin.
        </p>
      )}
    </section>
  );
}
