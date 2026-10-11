import { toast } from '@angaria/ui';
import { spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useStore as useFormState } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { SessionInfo } from 'angaria-earsiv-sdk';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { createDraftInvoice, getDrafts } from '@/lib/angaria.ts';
import { customerName, defaultPDFLanguage, findCustomer, learnCustomer } from '@/lib/customer.ts';
import { toastDownloaded, toastPreparing } from '@/lib/download-toast.tsx';
import { gib, invoiceHTMLQuery, useGIBAccount } from '@/lib/gib.ts';
import { saveDueDate } from '@/lib/invoice-due-dates.ts';
import {
  cleanItems,
  invoiceDefaults,
  invoiceTotals,
  invoiceWarnings,
  parseDecimal,
  sameInvoice,
  toDraftDetails,
  toPDFData,
  unparsableItemFields,
  upsertSavedItems,
} from '@/lib/invoice-form.ts';
import { resolvePDFLanguage } from '@/lib/invoice-pdf-i18n.ts';
import { readQRValue } from '@/lib/invoice-preview.ts';
import { rangeCovering } from '@/lib/invoices.ts';
import { useStore } from '@/lib/store.tsx';
import type { Invoice, InvoiceFormValues, PDFLanguage } from '@/lib/types.ts';
import { useRequireCredentials } from '@/shell/credentials-guard.tsx';
import { shell } from '../shell/shell.stylex.ts';
import { AdvancedSection } from './invoice-advanced.tsx';
import { InvoiceSection } from './invoice-header.tsx';
import { InvoiceItems } from './invoice-items.tsx';
import { displayName, RecipientSection } from './invoice-recipient.tsx';
import { Section, sectionStyles } from './invoice-section.tsx';
import { SuccessPanel, SummaryPanel, type CreatedDraft } from './invoice-summary.tsx';
import { useCurrencyRate } from './use-currency-rate.ts';
import { useClearInvoiceForm, useInvoiceForm, useStoredInvoiceForm } from './use-invoice-form.ts';
import { useSMSSign } from './use-sms-sign.tsx';

const isMac = navigator.userAgent.includes('Mac');

// Two columns from this viewport width: the form, and the summary beside it.
const WIDE = '@media (min-width: 1080px)';

const styles = create({
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
  form: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
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
});

/**
 * What takes focus for an invalid control. A chip group (ChoiceChips) is not
 * focusable itself: its Diğer input, else its chosen chip, else its first chip.
 */
function focusTarget(invalid: HTMLElement) {
  if (invalid.getAttribute('role') !== 'radiogroup') {
    return invalid;
  }
  return (
    (invalid.id ? document.getElementById(`${invalid.id}-other`) : null) ??
    invalid.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ??
    invalid.querySelector<HTMLElement>('[role="radio"]:not([data-disabled])') ??
    invalid
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
    const target = focusTarget(invalid);
    target.scrollIntoView({ block: 'center' });
    target.focus({ preventScroll: true });
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
      const done = draft.signed ? 'Fatura onaylandı' : 'Taslak oluşturuldu';
      if (draft.html) {
        toast.success(done);
      } else {
        toast.warning(`${done} ama GİB’den doğrulanamadı. Faturalar’da kontrol et.`);
      }

      // Make the new draft visible in the invoices list: refetch it and
      // widen the date range to cover the invoice date if needed.
      void queryClient.invalidateQueries({ queryKey: ['invoices', account.key] });
      setInvoiceDateRange((prev) => rangeCovering(prev, draft.date));

      if (draft.uuid && values.advancedFields.dueDate) {
        saveDueDate(draft.uuid, values.advancedFields.dueDate);
      }
      // Every invoice keeps its customer and services up to date.
      setSavedItems((prev) =>
        upsertSavedItems(prev, cleanItems(values.items), newId, values.invoiceSettings.currency),
      );
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

  const { foreign, rateDescription } = useCurrencyRate(form, values);

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
    const id = toastPreparing('PDF hazırlanıyor…');
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
      .then((file) => toastDownloaded(id, 'PDF kaydedildi', file))
      .catch(() => toast.error('PDF oluşturulamadı. Tekrar dene.', { id }));
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
    const target = event.target as Element | null;
    if (
      !mod ||
      event.key !== 'Enter' ||
      event.altKey ||
      event.isComposing ||
      // A chip (Base UI radio) cancels every Enter, ⌘↵ too, only so that Enter
      // never checks it: that one still submits.
      (event.defaultPrevented && !target?.closest?.('[role="radio"]')) ||
      // A dialog's own Enter handling wins (the SMS code dialog).
      target?.closest?.('[role="dialog"], [role="alertdialog"]')
    ) {
      return;
    }
    event.preventDefault();
    if (!success && !form.state.isSubmitting) {
      void form.handleSubmit({ sign: event.shiftKey });
    }
  });

  // A new form (Boş fatura, Tekrar kes, undo) replaced what held the focus:
  // the customer picker, the form's first field, takes it.
  useEffect(() => {
    if (!document.activeElement || document.activeElement === document.body) {
      document.getElementById('customer-picker')?.focus();
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => submitShortcut(event);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const total = useMemo(() => invoiceTotals(values.items).total, [values.items]);
  const rate = foreign ? parseDecimal(values.invoiceSettings.currencyRate) : null;
  const warnings = useMemo(
    () => invoiceWarnings(values, undefined, companyInfo.taxID),
    [companyInfo.taxID, values],
  );

  return (
    <div ref={rootRef} {...props(styles.page)}>
      <div {...props(styles.layout)}>
        <div {...props(styles.form)}>
          <RecipientSection form={form} recipient={values.recipient} />
          <InvoiceSection
            form={form}
            rateDescription={rateDescription}
            values={values}
            warnings={warnings}
          />
          <Section title="Hizmetler">
            <InvoiceItems form={form} />
          </Section>
          <section {...props(sectionStyles.section)}>
            <form.AppField name="note">
              {(field) => (
                <field.TextareaField label="Not" placeholder="Faturada görünecek not" rows={2} />
              )}
            </form.AppField>
          </section>
          <AdvancedSection
            currency={values.invoiceSettings.currency}
            form={form}
            total={total}
            warnings={warnings}
          />
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
              warnings={[...new Set(Object.values(warnings))]}
            />
          )}
        </aside>
      </div>
      {sms.dialog}
    </div>
  );
}
