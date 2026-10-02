import { colors } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { GIB_INVOICE_TYPES } from '@/lib/gib-constants.ts';
import { TCMB_RATE_ERROR } from '@/lib/gib-errors.ts';
import { CURRENCY_OPTIONS } from '@/lib/invoice-form.ts';
import type { InvoiceFormValues } from '@/lib/types.ts';
import { formatDateHuman, toGIB } from '@/lib/utils.ts';
import { invoiceTypeLabel } from '@/shell/searchable-list.tsx';
import { Section, sectionStyles } from './invoice-section.tsx';
import type { RateDescription } from './use-currency-rate.ts';
import type { InvoiceForm } from './use-invoice-form.ts';

const styles = create({
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
  warning: {
    color: colors.warning,
  },
});

const INVOICE_TYPE_OPTIONS = GIB_INVOICE_TYPES.map((type) => ({
  label: invoiceTypeLabel(type.value),
  value: type.value,
}));

/** The rate field's caption: where the rate comes from, or why it is missing. */
function rateCaption(form: InvoiceForm, description: RateDescription | null): ReactNode {
  switch (description?.kind) {
    case 'manual':
      return (
        <>
          Elle girildi.{' '}
          {description.tcmbAvailable && (
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
    case 'error':
      return <span {...props(styles.warning)}>{TCMB_RATE_ERROR}</span>;
    case 'unpublished':
      return 'TCMB bu para birimi için kur yayınlamıyor. Kuru elle gir.';
    case 'tcmb':
      return `TCMB döviz alış kuru, ${formatDateHuman(toGIB(description.date))}`;
    case 'loading':
      return 'TCMB kuru alınıyor…';
    case undefined:
      return null;
  }
}

export function InvoiceSection({
  form,
  rateDescription,
  values,
}: {
  form: InvoiceForm;
  rateDescription: RateDescription | null;
  values: InvoiceFormValues;
}) {
  return (
    <Section title="Fatura">
      <div {...props(sectionStyles.fields)}>
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
                description={rateCaption(form, rateDescription)}
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
