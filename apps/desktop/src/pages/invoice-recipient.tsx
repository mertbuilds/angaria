import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Field,
  FieldLabel,
} from '@angaria/ui';
import { colors, font } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { UNNAMED_CUSTOMER } from '@/lib/copy.ts';
import { customerName, findCustomer } from '@/lib/customer.ts';
import { GIB_COUNTRIES } from '@/lib/gib-constants.ts';
import { applyCustomer } from '@/lib/invoice-form.ts';
import { useStore } from '@/lib/store.tsx';
import type { Recipient } from '@/lib/types.ts';
import { matchesQuery } from '@/shell/searchable-list.tsx';
import { Section, sectionStyles } from './invoice-section.tsx';
import type { InvoiceForm } from './use-invoice-form.ts';

const styles = create({
  customerOption: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: font.sizeXs,
    fontVariantNumeric: 'tabular-nums',
    marginInlineStart: 'auto',
  },
  fullRow: {
    gridColumn: '1 / -1',
  },
});

const COUNTRY_OPTIONS = [...new Set(GIB_COUNTRIES.map((country) => country.value))].map(
  (country) => ({ label: country, value: country }),
);

export const displayName = (customer: Recipient) => customerName(customer) || UNNAMED_CUSTOMER;

export function RecipientSection({ form, recipient }: { form: InvoiceForm; recipient: Recipient }) {
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
    <Section title="Müşteri">
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
      <div {...props(sectionStyles.fields)}>
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
              placeholder="Ülke seç"
            />
          )}
        </form.AppField>
      </div>
    </Section>
  );
}
