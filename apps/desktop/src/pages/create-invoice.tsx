import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Field,
  FieldLabel,
  toast,
} from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useStore as useFormState } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { SessionInfo } from 'angaria-earsiv-sdk';
import { ChevronRightIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from 'react';
import { createDraftInvoice, fetchTCMBRateTable, getDrafts } from '@/lib/angaria.ts';
import { customerName, defaultPDFLanguage, findCustomer, learnCustomer } from '@/lib/customer.ts';
import { GIB_COUNTRIES, GIB_INVOICE_TYPES } from '@/lib/gib-constants.ts';
import { gib, invoiceHTMLQuery, useGIBAccount } from '@/lib/gib.ts';
import { saveDueDate } from '@/lib/invoice-due-dates.ts';
import {
  applyCustomer,
  cleanItems,
  CURRENCY_OPTIONS,
  formatDecimal,
  formatRate,
  invoiceDefaults,
  invoiceTotals,
  parseDecimal,
  sameInvoice,
  toDraftDetails,
  toPDFData,
  unparsableItemFields,
  upsertSavedItems,
} from '@/lib/invoice-form.ts';
import { resolvePDFLanguage } from '@/lib/invoice-pdf-i18n.ts';
import { readQRValue } from '@/lib/invoice-preview.ts';
import { useStore } from '@/lib/store.tsx';
import type { Invoice, InvoiceFormValues, PDFLanguage, Recipient } from '@/lib/types.ts';
import { formatDateHuman, parseGIB, toGIB } from '@/lib/utils.ts';
import { useRequireCredentials } from '@/shell/credentials-guard.tsx';
import { invoiceTypeLabel, matchesQuery } from '@/shell/searchable-list.tsx';
import { shell } from '../shell/shell.stylex.ts';
import { InvoiceItems } from './invoice-items.tsx';
import { SuccessPanel, SummaryPanel, type CreatedDraft } from './invoice-summary.tsx';
import {
  useClearInvoiceForm,
  useInvoiceForm,
  useStoredInvoiceForm,
  type InvoiceForm,
} from './use-invoice-form.ts';
import { useSMSSign } from './use-sms-sign.tsx';

const isMac = navigator.userAgent.includes('Mac');

// Two columns from this viewport width: the form, and the summary beside it.
const WIDE = '@media (min-width: 1080px)';

const styles = create({
  advancedFields: {
    paddingTop: spacing.s4,
  },
  aside: {
    alignSelf: 'start',
    // Sticky beside the form, and scrolls itself when the window is short.
    maxHeight: {
      [WIDE]: `calc(100dvh - ${shell.toolbarHeight} - ${spacing.s12})`,
      default: null,
    },
    overflowY: {
      [WIDE]: 'auto',
      default: null,
    },
    position: {
      [WIDE]: 'sticky',
      default: 'static',
    },
    top: spacing.s6,
  },
  customerOption: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: font.sizeXs,
    fontVariantNumeric: 'tabular-nums',
    marginInlineStart: 'auto',
  },
  fields: {
    display: 'grid',
    gap: spacing.s4,
    gridTemplateColumns: {
      '@media (min-width: 720px)': 'repeat(2, minmax(0, 1fr))',
      default: 'minmax(0, 1fr)',
    },
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  fullRow: {
    gridColumn: '1 / -1',
  },
  inlineAction: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: colors.fg,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    padding: 0,
    textDecorationLine: 'underline',
    textUnderlineOffset: '2px',
  },
  layout: {
    alignItems: 'start',
    display: 'grid',
    gap: spacing.s8,
    gridTemplateColumns: {
      [WIDE]: 'minmax(0, 1fr) 20rem',
      default: 'minmax(0, 1fr)',
    },
  },
  page: {
    boxSizing: 'border-box',
    marginInline: 'auto',
    maxWidth: '72rem',
    paddingBottom: spacing.s12,
    paddingInline: spacing.s6,
    paddingTop: spacing.s2,
    width: '100%',
  },
  section: {
    borderTopColor: colors.border,
    borderTopStyle: 'solid',
    borderTopWidth: {
      ':first-child': 0,
      default: '1px',
    },
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    paddingBlock: spacing.s6,
  },
  sectionHeader: {
    alignItems: 'baseline',
    display: 'flex',
    gap: spacing.s3,
    justifyContent: 'space-between',
  },
  sectionHint: {
    color: colors.muted,
    fontSize: font.sizeXs,
  },
  sectionTitle: {
    color: colors.fg,
    fontSize: font.sizeMd,
    fontWeight: font.weightMedium,
    margin: 0,
  },
  summary: {
    '::-webkit-details-marker': {
      display: 'none',
    },
    alignItems: 'center',
    borderRadius: radius.base,
    cursor: 'pointer',
    display: 'flex',
    gap: spacing.s2,
    listStyle: 'none',
    outline: {
      ':focus-visible': `1px solid ${colors.muted}`,
      default: 'none',
    },
    outlineOffset: '4px',
    userSelect: 'none',
  },
  summaryIcon: {
    color: colors.muted,
    height: '1rem',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '150ms',
    },
    transitionProperty: 'transform',
    width: '1rem',
  },
  summaryIconOpen: {
    transform: 'rotate(90deg)',
  },
  warning: {
    color: colors.warning,
  },
});

const COUNTRY_OPTIONS = [...new Set(GIB_COUNTRIES.map((country) => country.value))].map(
  (country) => ({ label: country, value: country }),
);

const INVOICE_TYPE_OPTIONS = GIB_INVOICE_TYPES.map((type) => ({
  label: invoiceTypeLabel(type.value),
  value: type.value,
}));

const displayName = (customer: Recipient) => customerName(customer) || 'Adsız müşteri';

function Section({ children, hint, title }: { children: ReactNode; hint?: string; title: string }) {
  return (
    <section {...props(styles.section)}>
      <div {...props(styles.sectionHeader)}>
        <h2 {...props(styles.sectionTitle)}>{title}</h2>
        {hint && <span {...props(styles.sectionHint)}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function RecipientSection({ form, recipient }: { form: InvoiceForm; recipient: Recipient }) {
  const { savedRecipients } = useStore();
  const matched = findCustomer(savedRecipients, recipient.taxIDOrTRID, customerName(recipient));

  // The customer's defaults set more than the recipient. Their listeners stay
  // quiet: applyCustomer already resets a new currency's rate.
  const pickCustomer = (customer: Recipient) => {
    const next = applyCustomer(form.state.values, customer);
    form.setFieldValue('recipient', next.recipient, { dontRunListeners: true });
    form.setFieldValue('invoiceSettings', next.invoiceSettings, { dontRunListeners: true });
    form.setFieldValue('items', next.items, { dontRunListeners: true });
    form.setFieldValue('advancedFields', next.advancedFields, { dontRunListeners: true });
  };

  return (
    <Section title="Alıcı">
      {savedRecipients.length > 0 && (
        <Field>
          <FieldLabel htmlFor="customer-picker">Kayıtlı müşteri</FieldLabel>
          <Combobox
            filter={(customer: Recipient, query: string) =>
              matchesQuery(
                query,
                customer.title,
                customer.name,
                customer.surname,
                customer.taxIDOrTRID,
              )
            }
            isItemEqualToValue={(item: Recipient, value: Recipient) => item.id === value.id}
            items={savedRecipients}
            itemToStringLabel={displayName}
            onValueChange={(customer: Recipient | null) => customer && pickCustomer(customer)}
            value={matched}
          >
            <ComboboxInput
              id="customer-picker"
              onFocus={(event) => event.currentTarget.select()}
              placeholder="Müşteri ara"
            />
            <ComboboxContent>
              <ComboboxEmpty>Müşteri bulunamadı</ComboboxEmpty>
              <ComboboxList>
                {(customer: Recipient) => (
                  <ComboboxItem key={customer.id} value={customer}>
                    {displayName(customer)}
                    <span {...props(styles.customerOption)}>{customer.taxIDOrTRID}</span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </Field>
      )}
      <div {...props(styles.fields)}>
        <form.AppField name="recipient.title">
          {(field) => (
            <field.TextField
              label="Unvan"
              placeholder="Örnek Teknoloji A.Ş."
              style={styles.fullRow}
            />
          )}
        </form.AppField>
        <form.AppField name="recipient.name">
          {(field) => <field.TextField label="Ad" />}
        </form.AppField>
        <form.AppField name="recipient.surname">
          {(field) => <field.TextField label="Soyad" />}
        </form.AppField>
        <form.AppField name="recipient.taxIDOrTRID">
          {(field) => (
            <field.TextField
              description="Yurt dışındaki müşteri için 2222222222"
              inputMode="numeric"
              label="VKN / TCKN"
              maxLength={11}
              placeholder="1234567890"
            />
          )}
        </form.AppField>
        <form.AppField name="recipient.taxOffice">
          {(field) => <field.TextField label="Vergi dairesi" />}
        </form.AppField>
        <form.AppField name="recipient.fullAddress">
          {(field) => (
            <field.TextareaField
              label="Adres"
              placeholder="Cadde, sokak, bina ve kapı numarası"
              rows={2}
              style={styles.fullRow}
            />
          )}
        </form.AppField>
        <form.AppField name="recipient.district">
          {(field) => <field.TextField label="İlçe" />}
        </form.AppField>
        <form.AppField name="recipient.city">
          {(field) => <field.TextField label="Şehir" />}
        </form.AppField>
        <form.AppField name="recipient.country">
          {(field) => (
            <field.ComboboxField
              clearable
              emptyText="Ülke bulunamadı"
              items={COUNTRY_OPTIONS}
              label="Ülke"
              placeholder="Ülke seçin"
            />
          )}
        </form.AppField>
      </div>
    </Section>
  );
}

function InvoiceSection({
  form,
  rateDescription,
  values,
}: {
  form: InvoiceForm;
  rateDescription: ReactNode;
  values: InvoiceFormValues;
}) {
  return (
    <Section title="Fatura">
      <div {...props(styles.fields)}>
        <form.AppField name="advancedFields.manualDate">
          {(field) => <field.DateField emptyIsToday label="Tarih" />}
        </form.AppField>
        <form.AppField name="advancedFields.manualTime">
          {(field) => <field.TimeField label="Saat" />}
        </form.AppField>
        <form.AppField name="invoiceSettings.invoiceType">
          {(field) => <field.SelectField items={INVOICE_TYPE_OPTIONS} label="Fatura tipi" />}
        </form.AppField>
        <form.AppField
          listeners={{
            // A new currency starts from its TCMB rate again.
            onChange: () => {
              form.setFieldValue('invoiceSettings.currencyRate', '', {
                dontRunListeners: true,
                dontUpdateMeta: true,
              });
              form.setFieldValue('advancedFields.currencyRateManual', false);
            },
          }}
          name="invoiceSettings.currency"
        >
          {(field) => (
            <field.ComboboxField
              emptyText="Para birimi bulunamadı"
              items={CURRENCY_OPTIONS}
              label="Para birimi"
            />
          )}
        </form.AppField>
        {values.invoiceSettings.currency !== 'TRY' && (
          <form.AppField
            listeners={{
              onChange: () => form.setFieldValue('advancedFields.currencyRateManual', true),
            }}
            name="invoiceSettings.currencyRate"
          >
            {(field) => (
              <field.TextField
                description={rateDescription}
                inputMode="decimal"
                label="Döviz kuru"
                placeholder="0,0000"
              />
            )}
          </form.AppField>
        )}
        <form.AppField name="advancedFields.dueDate">
          {(field) => (
            <field.DateField
              allowFuture
              description="Yalnızca PDF’te görünür, GİB’e gönderilmez"
              label="Son ödeme tarihi"
            />
          )}
        </form.AppField>
      </div>
    </Section>
  );
}

function AdvancedSection({ form, total }: { form: InvoiceForm; total: string }) {
  const advanced = form.state.values.advancedFields;
  const [open, setOpen] = useState(() =>
    Boolean(advanced.irsaliyeNumarasi || advanced.irsaliyeTarihi || advanced.paymentTotal),
  );

  return (
    <section {...props(styles.section)}>
      <details onToggle={(event) => setOpen(event.currentTarget.open)} open={open}>
        <summary {...props(styles.summary)}>
          <ChevronRightIcon
            aria-hidden
            {...props(styles.summaryIcon, open && styles.summaryIconOpen)}
          />
          <h2 {...props(styles.sectionTitle)}>Gelişmiş</h2>
          <span {...props(styles.sectionHint)}>İrsaliye, ödenecek tutar</span>
        </summary>
        <div {...props(styles.fields, styles.advancedFields)}>
          <form.AppField name="advancedFields.irsaliyeNumarasi">
            {(field) => <field.TextField label="İrsaliye numarası" />}
          </form.AppField>
          <form.AppField name="advancedFields.irsaliyeTarihi">
            {(field) => <field.DateField label="İrsaliye tarihi" />}
          </form.AppField>
          <form.AppField name="advancedFields.paymentTotal">
            {(field) => (
              <field.TextField
                description="Boş bırakırsanız genel toplam ödenir"
                inputMode="decimal"
                label="Ödenecek tutar"
                placeholder={total}
              />
            )}
          </form.AppField>
        </div>
      </details>
    </section>
  );
}

/**
 * Opens the first field with a visible error (inside a closed details
 * section too) and focuses it.
 */
function revealFirstError(root: HTMLElement | null) {
  requestAnimationFrame(() => {
    const invalid = root?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!invalid) {
      return;
    }
    const details = invalid.closest('details');
    if (details) {
      details.open = true;
    }
    invalid.scrollIntoView({ block: 'center' });
    invalid.focus({ preventScroll: true });
  });
}

/**
 * Yeni fatura: the form on the left, the totals and actions on the right
 * (stacked on narrow windows). Mount it keyed by the store's
 * invoiceFormRevision: it starts from the store's form and writes every
 * change back, so the form survives leaving the screen.
 */
export function CreateInvoicePage() {
  const {
    activeEntity,
    companyInfo,
    newId,
    resetInvoiceForm,
    savedRecipients,
    setAdvancedFields,
    setInvoiceDateRange,
    setInvoiceSettings,
    setItems,
    setNote,
    setRecipient,
    setSavedItems,
    setSavedRecipients,
  } = useStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const requireCredentials = useRequireCredentials();
  const account = useGIBAccount();
  const clearForm = useClearInvoiceForm();
  const stored = useStoredInvoiceForm();
  const [defaultValues] = useState(stored);
  const rootRef = useRef<HTMLDivElement>(null);
  const [created, setCreated] = useState<{
    draft: CreatedDraft;
    values: InvoiceFormValues;
  } | null>(null);
  const sms = useSMSSign();

  const createDraft = useMutation({
    mutationFn: async ({
      sign,
      values,
    }: {
      pdfLanguage: PDFLanguage;
      sign: boolean;
      values: InvoiceFormValues;
    }) => {
      const createOnGIB = async (session: SessionInfo): Promise<CreatedDraft> => {
        const result = await createDraftInvoice(session, toDraftDetails(values));
        if (!result.uuid) {
          return { date: result.date, uuid: '' };
        }
        // The number is an extra: the draft exists either way.
        const drafts = (await getDrafts(session, result.date, result.date).catch(
          () => [],
        )) as Array<Invoice>;
        const number = drafts.find((row) => row.ettn === result.uuid)?.belgeNumarasi;
        return { date: result.date, number, uuid: result.uuid };
      };
      let draft: CreatedDraft;
      if (sign) {
        // Created and signed on one session: the SMS code goes out right away.
        const result = await sms.sign(async (session) => {
          const value = await createOnGIB(session);
          return { ettns: value.uuid ? [value.uuid] : [], value };
        });
        if (!result) {
          return null;
        }
        draft = { ...result.value, signed: result.signed };
      } else {
        draft = await gib.run(account, createOnGIB);
      }
      if (draft.uuid) {
        // Cached for the invoice screen too. Optional: without it the draft
        // still exists, only unverified.
        draft.html = await queryClient
          .fetchQuery(
            invoiceHTMLQuery(account, draft.uuid, draft.signed ? 'Onaylandı' : 'Onaylanmadı'),
          )
          .catch(() => undefined);
      }
      return { draft, values };
    },
    // Null: the screen closed before GİB answered.
    onSuccess: (result, { pdfLanguage }) => {
      if (!result) {
        return;
      }
      const { draft, values } = result;
      const done = draft.signed ? 'Fatura onaylandı' : 'Taslak fatura oluşturuldu';
      if (draft.html) {
        toast.success(done);
      } else {
        toast.warning(`${done} ama GİB’den doğrulanamadı. Faturalar listesinden kontrol edin.`);
      }

      // Make the new draft visible in the invoices list: refetch it and
      // widen the date range to cover the invoice date if needed.
      void queryClient.invalidateQueries({ queryKey: ['invoices', account.key] });
      const createdDate = parseGIB(draft.date);
      if (createdDate) {
        setInvoiceDateRange((prev) => {
          const start = parseGIB(prev.start);
          const end = parseGIB(prev.end);
          return {
            start: start && start <= createdDate ? prev.start : draft.date,
            end: end && end >= createdDate ? prev.end : draft.date,
          };
        });
      }

      if (draft.uuid && values.advancedFields.dueDate) {
        saveDueDate(draft.uuid, values.advancedFields.dueDate);
      }
      // Every invoice keeps its customer and services up to date.
      setSavedItems((prev) => upsertSavedItems(prev, cleanItems(values.items), newId));
      const learned = learnCustomer(
        savedRecipients,
        values.recipient,
        invoiceDefaults(values, { date: draft.date, pdfLanguage }),
        newId,
      );
      setSavedRecipients(learned.customers);
      if (learned.added) {
        toast('Müşteri kaydedildi', { description: displayName(values.recipient) });
      }
      setCreated({ draft, values });
    },
  });

  /** The invoice's PDF language: its own choice, else its customer's default. */
  const pdfLanguageOf = (source: InvoiceFormValues) => {
    const { recipient } = source;
    const saved = findCustomer(savedRecipients, recipient.taxIDOrTRID, customerName(recipient));
    return resolvePDFLanguage(recipient.pdfLanguage, defaultPDFLanguage(saved ?? recipient));
  };

  const form = useInvoiceForm({
    defaultValues,
    onSubmit: async (values, { sign }) => {
      if (!requireCredentials()) {
        return;
      }
      // A failure shows as a toast (the app's MutationCache).
      await createDraft
        .mutateAsync({ pdfLanguage: pdfLanguageOf(values), sign, values })
        .catch(() => {});
    },
    onSubmitInvalid: () => revealFirstError(rootRef.current),
  });
  const values = useFormState(form.store, (state) => state.values);

  // Write every change back to the store, so the form outlives this screen.
  useEffect(() => {
    if (values.recipient !== stored.recipient) {
      setRecipient(values.recipient);
    }
    if (values.invoiceSettings !== stored.invoiceSettings) {
      setInvoiceSettings(values.invoiceSettings);
    }
    if (values.items !== stored.items) {
      setItems(values.items);
    }
    if (values.note !== stored.note) {
      setNote(values.note);
    }
    if (values.advancedFields !== stored.advancedFields) {
      setAdvancedFields(values.advancedFields);
    }
  }, [setAdvancedFields, setInvoiceSettings, setItems, setNote, setRecipient, stored, values]);

  // TCMB's buying rate fills the rate field until the user types one.
  const currency = values.invoiceSettings.currency;
  const foreign = currency !== 'TRY';
  const rateDate = values.advancedFields.manualDate;
  const rateManual = values.advancedFields.currencyRateManual === true;
  const rates = useQuery({
    enabled: foreign,
    queryFn: () => fetchTCMBRateTable(parseGIB(rateDate)),
    queryKey: ['tcmb-rates', rateDate],
    staleTime: 5 * 60 * 1000,
  });
  const tcmbRate = foreign ? rates.data?.rates.get(currency) : undefined;

  useEffect(() => {
    if (rateManual || tcmbRate === undefined) {
      return;
    }
    const text = formatRate(tcmbRate);
    if (form.getFieldValue('invoiceSettings.currencyRate') !== text) {
      form.setFieldValue('invoiceSettings.currencyRate', text, {
        dontRunListeners: true,
        dontUpdateMeta: true,
      });
    }
  }, [form, rateManual, tcmbRate]);

  let rateDescription: ReactNode = null;
  if (rateManual) {
    rateDescription = (
      <>
        Elle girildi.{' '}
        {tcmbRate !== undefined && (
          <button
            onClick={() => form.setFieldValue('advancedFields.currencyRateManual', false)}
            type="button"
            {...props(styles.inlineAction)}
          >
            TCMB kurunu kullan
          </button>
        )}
      </>
    );
  } else if (rates.isError) {
    rateDescription = <span {...props(styles.warning)}>TCMB kuru alınamadı. Kuru elle girin.</span>;
  } else if (rates.data && tcmbRate === undefined) {
    rateDescription = 'TCMB bu para birimine kur yayınlamıyor. Kuru elle girin.';
  } else if (rates.data) {
    rateDescription = `TCMB alış, ${formatDateHuman(toGIB(rates.data.date))}`;
  } else if (foreign) {
    rateDescription = 'TCMB kuru alınıyor';
  }

  const pdfLanguage = pdfLanguageOf(values);
  const setPDFLanguage = (language: PDFLanguage) =>
    form.setFieldValue('recipient.pdfLanguage', language, { dontUpdateMeta: true });

  /** The PDF of `source`; `created` carries GİB's number and date once the draft exists. */
  const downloadPDF = (source: InvoiceFormValues, created?: CreatedDraft) => {
    // A number that does not parse would print as NaN: show its error instead.
    const unparsable = unparsableItemFields(source.items);
    if (unparsable.length > 0) {
      for (const name of unparsable) {
        form.setFieldMeta(name, (meta) => ({ ...meta, isTouched: true }));
      }
      void form.validate('change');
      revealFirstError(rootRef.current);
      return;
    }
    const id = toast.loading('PDF hazırlanıyor');
    const data = toPDFData(source, {
      company: companyInfo,
      date: created?.date,
      entityName: activeEntity.name,
      ettn: created?.uuid || undefined,
      gibNumber: created?.number,
      language: pdfLanguage,
      // GİB's QR code, once the invoice is signed.
      qrValue: created?.signed && created.html ? readQRValue(created.html) : undefined,
    });
    // react-pdf is large, so it loads with the first PDF.
    import('@/components/invoice-pdf.tsx')
      .then(({ downloadInvoicePDF }) => downloadInvoicePDF(data))
      .then(() => toast.success('PDF indirildi', { id }))
      .catch(() => toast.error('PDF oluşturulamadı', { id }));
  };

  // The success state lasts until the invoice is edited (the PDF language aside).
  const success = created && sameInvoice(values, created.values) ? created : null;

  const openCreated = () => {
    if (!success?.draft.uuid) {
      void navigate({ to: '/faturalar' });
      return;
    }
    void navigate({ params: { ettn: success.draft.uuid }, to: '/faturalar/$ettn' });
  };

  // ⌘↵ creates the draft, ⌘⇧↵ creates and signs it.
  const submitShortcut = useEffectEvent((event: KeyboardEvent) => {
    const mod = isMac ? event.metaKey : event.ctrlKey;
    if (
      !mod ||
      event.key !== 'Enter' ||
      event.altKey ||
      event.isComposing ||
      event.defaultPrevented ||
      // A dialog's own Enter handling wins (the SMS code dialog).
      (event.target as Element | null)?.closest?.('[role="dialog"], [role="alertdialog"]')
    ) {
      return;
    }
    event.preventDefault();
    if (!success && !form.state.isSubmitting) {
      void form.handleSubmit({ sign: event.shiftKey });
    }
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => submitShortcut(event);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const totalText = useMemo(
    () => formatDecimal(invoiceTotals(values.items).total, 2),
    [values.items],
  );
  const rate = foreign ? parseDecimal(values.invoiceSettings.currencyRate) : null;

  return (
    <div ref={rootRef} {...props(styles.page)}>
      <div {...props(styles.layout)}>
        <div {...props(styles.form)}>
          <RecipientSection form={form} recipient={values.recipient} />
          <InvoiceSection form={form} rateDescription={rateDescription} values={values} />
          <Section title="Kalemler">
            <InvoiceItems form={form} />
          </Section>
          <section {...props(styles.section)}>
            <form.AppField name="note">
              {(field) => (
                <field.TextareaField label="Not" placeholder="Faturada görünecek not" rows={2} />
              )}
            </form.AppField>
          </section>
          <AdvancedSection form={form} total={totalText} />
        </div>
        <aside {...props(styles.aside)}>
          {success ? (
            <SuccessPanel
              created={success.draft}
              onDownloadPDF={() => downloadPDF(success.values, success.draft)}
              onNewInvoice={resetInvoiceForm}
              onOpenInvoice={openCreated}
              onPDFLanguageChange={setPDFLanguage}
              pdfLanguage={pdfLanguage}
            />
          ) : (
            <SummaryPanel
              form={form}
              onClear={clearForm}
              onDownloadPDF={() => downloadPDF(values)}
              onPDFLanguageChange={setPDFLanguage}
              pdfLanguage={pdfLanguage}
              rate={rate}
              signing={createDraft.isPending && createDraft.variables?.sign === true}
              values={values}
            />
          )}
        </aside>
      </div>
      {sms.dialog}
    </div>
  );
}
