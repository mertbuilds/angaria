import {
  Button,
  ChoiceChips,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  type DatePreset,
} from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { addDays, differenceInCalendarDays, isSameDay } from 'date-fns';
import { ChevronDownIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useMemo, type ReactNode } from 'react';
import { FieldFrame, useFieldContext, useFieldError } from '@/lib/form-field.tsx';
import { GIB_INVOICE_TYPES } from '@/lib/gib-constants.ts';
import { TCMB_RATE_ERROR } from '@/lib/gib-errors.ts';
import { CURRENCY_OPTIONS, formatRate, istisnaNote } from '@/lib/invoice-form.ts';
import { DUE_DAY_PRESETS, ISTISNA_REASONS, SUPPORTED_INVOICE_TYPES } from '@/lib/regulated.ts';
import { gibToCalendarDate } from '@/lib/tr-date.ts';
import type { InvoiceFormValues } from '@/lib/types.ts';
import { parseGIB, toGIB } from '@/lib/utils.ts';
import { invoiceTypeLabel } from '@/shell/searchable-list.tsx';
import { DecimalTextField } from './decimal-text-field.tsx';
import { Section, sectionStyles } from './invoice-section.tsx';
import type { RateDescription } from './use-currency-rate.ts';
import type { InvoiceForm } from './use-invoice-form.ts';

const styles = create({
  // Starts a row of the two-column grid, so a pair keeps its line when the
  // field beside it comes and goes.
  firstColumn: {
    gridColumnStart: '1',
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
  menuIcon: {
    color: colors.muted,
    flexShrink: 0,
    height: '1rem',
    width: '1rem',
  },
  // Under the rate field, after its caption or error.
  rateReset: {
    alignSelf: 'flex-start',
    fontSize: font.sizeSm,
    minHeight: '1.5rem',
  },
  rateStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    minWidth: 0,
  },
  otherCurrency: {
    flexBasis: '10rem',
    flexGrow: 1,
    minWidth: '10rem',
  },
  typeRow: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  warning: {
    color: colors.warning,
  },
});

const INVOICE_DATE_PRESETS: ReadonlyArray<DatePreset> = [
  { date: (today) => today, label: 'Bugün' },
  { date: (today) => today.subtract({ days: 1 }), label: 'Dün' },
  { date: (today) => today.set({ day: 1 }).subtract({ days: 1 }), label: 'Geçen ayın son günü' },
];

const INVOICE_TYPE_CHOICES = SUPPORTED_INVOICE_TYPES.map((value) => ({
  label: invoiceTypeLabel(value),
  value,
}));

const OTHER_INVOICE_TYPES = GIB_INVOICE_TYPES.filter(
  (type) => !SUPPORTED_INVOICE_TYPES.includes(type.value),
);

const ISTISNA_REASON_OPTIONS = ISTISNA_REASONS.map((reason) => ({
  label: `${reason.code} · ${reason.label}`,
  value: reason.code,
}));

/** Hizmet ihracatı: what a freelancer's İstisna invoice usually is. */
const DEFAULT_ISTISNA_CODE = '302';

const PINNED_CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'];

const CURRENCY_CHOICES = PINNED_CURRENCIES.map((value) => ({ label: value, value }));

const OTHER_CURRENCIES = CURRENCY_OPTIONS.filter(
  (option) => !PINNED_CURRENCIES.includes(option.value),
);

/** The code of the İstisna reason whose sentence the note carries. */
const reasonInNote = (note: string) =>
  ISTISNA_REASONS.find((reason) => note.includes(reason.sentence))?.code;

/**
 * The days from the invoice date to `dueDate` when they are one of the Son
 * ödeme presets, else undefined: such a due date moves with the invoice date.
 */
function presetDueDays(invoiceDate: string, dueDate: string) {
  const due = parseGIB(dueDate);
  if (!due) {
    return undefined;
  }
  const days = differenceInCalendarDays(due, parseGIB(invoiceDate) ?? new Date());
  return DUE_DAY_PRESETS.includes(days) ? days : undefined;
}

const dayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "1 Eki", with the year when it is not this year's. */
const shortDate = (date: Date) =>
  (date.getFullYear() === new Date().getFullYear() ? dayMonth : dayMonthYear).format(date);

/** The rate field's caption: where the rate comes from, or why it is missing. */
function rateCaption(description: RateDescription | null): ReactNode {
  switch (description?.kind) {
    case 'manual':
      return 'Elle girildi';
    case 'error':
      return <span {...props(styles.warning)}>{TCMB_RATE_ERROR}</span>;
    case 'unpublished':
      return 'TCMB bu para birimi için kur yayınlamıyor. Kuru elle gir.';
    case 'tcmb': {
      const { publishedOn, validFor } = description;
      const bulletin = `TCMB döviz alış, ${shortDate(publishedOn)} bülteni`;
      return isSameDay(publishedOn, validFor)
        ? bulletin
        : `${bulletin} (${shortDate(validFor)} için)`;
    }
    case 'loading':
      return 'TCMB kuru alınıyor…';
    case undefined:
      return null;
  }
}

/**
 * Döviz kuru with its caption. A typed rate offers TCMB's back under the
 * field, outside the caption, so an error that hides the caption neither
 * hides it nor takes the focus with it.
 */
function CurrencyRateField({
  form,
  rateDescription,
}: {
  form: InvoiceForm;
  rateDescription: RateDescription | null;
}) {
  const offerTCMB = rateDescription?.kind === 'manual' && rateDescription.tcmbAvailable;
  return (
    <div {...props(styles.rateStack)}>
      <DecimalTextField
        description={rateCaption(rateDescription)}
        format={formatRate}
        label="Döviz kuru"
        placeholder="0,0000"
        step={0.01}
        suffix="₺"
      />
      {offerTCMB && (
        <button
          onClick={() => {
            form.setFieldValue('advancedFields.currencyRateManual', false);
            // The button goes with the typed rate; the focus goes back to the rate.
            document.getElementById('invoiceSettings.currencyRate')?.focus();
          }}
          type="button"
          {...props(styles.inlineAction, styles.rateReset)}
        >
          TCMB kurunu kullan
        </button>
      )}
    </div>
  );
}

/**
 * Satış or İstisna as chips. GİB's other types sit in a menu that only says
 * where to make them: a reissued invoice of such a type shows its name there,
 * and the form's check blocks it.
 */
function InvoiceTypeField({ description }: { description?: ReactNode }) {
  const field = useFieldContext<string>();
  const error = useFieldError();
  const value = field.state.value;
  const supported = SUPPORTED_INVOICE_TYPES.includes(value);
  return (
    <FieldFrame
      description={description}
      error={error}
      id={field.name}
      label="Fatura tipi"
      style={styles.firstColumn}
    >
      {(describedBy) => (
        <div {...props(styles.typeRow)}>
          <ChoiceChips
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            aria-labelledby={`${field.name}-label`}
            id={field.name}
            onValueChange={(next) => next && field.handleChange(next)}
            options={INVOICE_TYPE_CHOICES}
            value={supported ? value : null}
          />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" />}>
              {supported ? 'Diğer tipler' : invoiceTypeLabel(value)}
              <ChevronDownIcon aria-hidden {...props(styles.menuIcon)} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Bu tipler için GİB portalını kullan</DropdownMenuLabel>
              {OTHER_INVOICE_TYPES.map((type) => (
                <DropdownMenuItem disabled key={type.value}>
                  {invoiceTypeLabel(type.value)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </FieldFrame>
  );
}

/** Diğer's input for the currency: any of GİB's other currencies, by code or name. */
function OtherCurrency({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (currency: string) => void;
  value: string;
}) {
  const selected = OTHER_CURRENCIES.find((option) => option.value === value) ?? null;
  return (
    <div {...props(styles.otherCurrency)}>
      <Combobox
        isItemEqualToValue={(item, current) => item.value === current.value}
        items={OTHER_CURRENCIES}
        itemToStringLabel={(item) => item.label}
        locale="tr"
        onValueChange={(item) => item && onChange(item.value)}
        value={selected}
      >
        <ComboboxInput
          aria-label="Diğer para birimi"
          id={id}
          onFocus={(event) => event.currentTarget.select()}
          placeholder="Para birimi ara"
        />
        <ComboboxContent>
          <ComboboxEmpty>Para birimi bulunamadı</ComboboxEmpty>
          <ComboboxList>
            {(item: (typeof OTHER_CURRENCIES)[number]) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

/**
 * Yeni fatura's header: the date, invoice type (with the İstisna reason),
 * currency and rate, and the due date. Choosing İstisna puts the reason's
 * sentence at the start of the note (the rows lock their KDV at %0 in
 * invoice-items.tsx); going back to Satış offers to take the sentence out.
 */
export function InvoiceSection({
  form,
  rateDescription,
  values,
  warnings,
}: {
  form: InvoiceForm;
  rateDescription: RateDescription | null;
  values: InvoiceFormValues;
  /** invoiceWarnings of the form, keyed by field name. */
  warnings: Readonly<Record<string, string>>;
}) {
  const { dueDays, manualDate } = values.advancedFields;
  const { currency, invoiceType, istisnaCode } = values.invoiceSettings;

  const duePresets = useMemo(
    (): ReadonlyArray<DatePreset> =>
      DUE_DAY_PRESETS.map((days) => ({
        date: (today) => (gibToCalendarDate(manualDate) ?? today).add({ days }),
        label: days === 0 ? 'Peşin' : `${days} gün`,
      })),
    [manualDate],
  );

  /** An İstisna invoice's reason (its own, the note's, else 302) and its sentence in the note. */
  const applyIstisnaReason = () => {
    const { invoiceSettings, note } = form.state.values;
    const code = invoiceSettings.istisnaCode ?? reasonInNote(note) ?? DEFAULT_ISTISNA_CODE;
    if (invoiceSettings.istisnaCode !== code) {
      form.setFieldValue('invoiceSettings.istisnaCode', code, { dontRunListeners: true });
    }
    const next = istisnaNote(code, note);
    if (next !== note) {
      form.setFieldValue('note', next);
    }
  };

  // An İstisna invoice that arrived without a reason (a customer's defaults,
  // a reissued invoice) takes one.
  const giveIstisnaReason = useEffectEvent(applyIstisnaReason);
  useEffect(() => {
    if (invoiceType === 'ISTISNA' && !istisnaCode) {
      giveIstisnaReason();
    }
  }, [invoiceType, istisnaCode]);

  const sentenceInNote = reasonInNote(values.note) !== undefined;
  const typeDescription =
    invoiceType === 'SATIS' && sentenceInNote ? (
      <button
        onClick={() => {
          form.setFieldValue('note', istisnaNote(null, form.state.values.note));
          // The button goes with the sentence; the focus goes back to the type.
          document
            .querySelector<HTMLElement>('[id="invoiceSettings.invoiceType"] [aria-checked="true"]')
            ?.focus();
        }}
        type="button"
        {...props(styles.inlineAction)}
      >
        Nottaki istisna cümlesini kaldır
      </button>
    ) : undefined;

  let dueDescription = 'Yalnızca PDF’te görünür, GİB’e gönderilmez';
  if (dueDays === 0) {
    dueDescription = 'Peşin: fatura tarihinde. Yalnızca PDF’te görünür.';
  } else if (dueDays !== undefined) {
    dueDescription = `Fatura tarihinden ${dueDays} gün sonra. Yalnızca PDF’te görünür.`;
  }

  return (
    <Section title="Fatura">
      <div {...props(sectionStyles.fields)}>
        <form.AppField
          listeners={{
            // A due date set by a preset keeps its distance from the invoice date.
            onChange: ({ value }) => {
              const days = form.getFieldValue('advancedFields.dueDays');
              if (days !== undefined) {
                form.setFieldValue(
                  'advancedFields.dueDate',
                  toGIB(addDays(parseGIB(value) ?? new Date(), days)),
                  { dontRunListeners: true },
                );
              }
            },
          }}
          name="advancedFields.manualDate"
        >
          {(field) => (
            <field.DateField
              emptyIsToday
              label="Tarih"
              presets={INVOICE_DATE_PRESETS}
              warning={warnings['advancedFields.manualDate']}
            />
          )}
        </form.AppField>
        <form.AppField
          listeners={{
            onChange: ({ value }) => {
              const days = presetDueDays(form.getFieldValue('advancedFields.manualDate'), value);
              if (form.getFieldValue('advancedFields.dueDays') !== days) {
                form.setFieldValue('advancedFields.dueDays', days);
              }
            },
          }}
          name="advancedFields.dueDate"
        >
          {(field) => (
            <field.DateField
              allowFuture
              description={dueDescription}
              label="Son ödeme tarihi"
              presets={duePresets}
            />
          )}
        </form.AppField>
        <form.AppField
          listeners={{
            onChange: ({ value }) => {
              if (value === 'ISTISNA') {
                applyIstisnaReason();
              }
            },
          }}
          name="invoiceSettings.invoiceType"
        >
          {() => <InvoiceTypeField description={typeDescription} />}
        </form.AppField>
        {/* Mounted once the reason is set, so the select is controlled from its first render. */}
        {invoiceType === 'ISTISNA' && istisnaCode && (
          <form.AppField
            listeners={{
              onChange: ({ value }) =>
                form.setFieldValue('note', istisnaNote(value, form.state.values.note)),
            }}
            name="invoiceSettings.istisnaCode"
          >
            {(field) => (
              <field.SelectField
                description={
                  istisnaCode === '350'
                    ? 'Nedenini nota, cümlenin arkasına yaz'
                    : 'Gerekçe cümlesi notun başına yazılır'
                }
                items={ISTISNA_REASON_OPTIONS}
                label="İstisna nedeni"
              />
            )}
          </form.AppField>
        )}
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
            <field.ChoiceField
              label="Para birimi"
              options={CURRENCY_CHOICES}
              other={{
                label: 'Diğer',
                render: ({ id }) => (
                  <OtherCurrency id={id} onChange={field.handleChange} value={currency} />
                ),
              }}
              style={styles.firstColumn}
            />
          )}
        </form.AppField>
        {currency !== 'TRY' && (
          <form.AppField
            listeners={{
              onChange: () => form.setFieldValue('advancedFields.currencyRateManual', true),
            }}
            name="invoiceSettings.currencyRate"
          >
            {() => <CurrencyRateField form={form} rateDescription={rateDescription} />}
          </form.AppField>
        )}
      </div>
    </Section>
  );
}
