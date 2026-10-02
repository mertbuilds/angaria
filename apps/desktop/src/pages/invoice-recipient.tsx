import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Switch,
} from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props, type StyleXStyles } from '@stylexjs/stylex';
import { useStore as useFormStore } from '@tanstack/react-form';
import { CheckIcon, PlusIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { UNNAMED_CUSTOMER } from '@/lib/copy.ts';
import {
  byRecentInvoice,
  COUNTRY_OPTIONS,
  countryLabel,
  customerName,
  findCustomer,
  findCustomerByTaxID,
  FOREIGN_TAX_ID,
  isForeignCustomer,
  matchesCountry,
  normalizeTaxID,
  taxIDKind,
  UNDISCLOSED_TCKN,
  type CountryOption,
  type TaxIDKind,
} from '@/lib/customer.ts';
import { FieldFrame, useFieldContext, useFieldError } from '@/lib/form-field.tsx';
import { applyCustomer } from '@/lib/invoice-form.ts';
import { useStore } from '@/lib/store.tsx';
import { suggestTaxOffices } from '@/lib/tax-offices.ts';
import { CITY_NAMES, cityCode, matchesWords, searchKey } from '@/lib/tr-cities.ts';
import type { Recipient } from '@/lib/types.ts';
import { matchesQuery } from '@/shell/searchable-list.tsx';
import { Section, sectionStyles } from './invoice-section.tsx';
import type { InvoiceForm } from './use-invoice-form.ts';

const styles = create({
  check: {
    color: colors.muted,
    height: '1rem',
    insetInlineEnd: '1rem',
    pointerEvents: 'none',
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '1rem',
  },
  checked: {
    paddingInlineEnd: '2.5rem',
  },
  fullRow: {
    gridColumn: '1 / -1',
  },
  hint: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: font.sizeXs,
    fontVariantNumeric: 'tabular-nums',
    marginInlineStart: 'auto',
  },
  inputWrap: {
    position: 'relative',
  },
  itemIcon: {
    color: colors.muted,
    flexShrink: 0,
    height: '1rem',
    width: '1rem',
  },
  itemLabel: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // A field with lines under its own frame (a saved customer, a shortcut).
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    minWidth: 0,
  },
  status: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    ':empty': {
      display: 'none',
    },
  },
  statusName: {
    color: colors.fg,
  },
  switchLabel: {
    alignItems: 'center',
    color: colors.fg,
    cursor: 'pointer',
    display: 'inline-flex',
    fontSize: font.sizeSm,
    gap: spacing.s3,
    minHeight: '2.5rem',
    width: 'fit-content',
  },
  switchRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  tabular: {
    fontVariantNumeric: 'tabular-nums',
  },
  // Text that acts: underlined, in the surrounding size, with a 24px target.
  textAction: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: font.sizeSm,
    minHeight: '1.5rem',
    padding: 0,
    textDecorationLine: 'underline',
    textUnderlineOffset: '2px',
  },
  textActionInline: {
    color: colors.fg,
  },
});

export const displayName = (customer: Recipient) => customerName(customer) || UNNAMED_CUSTOMER;

/** A saved customer's muted tag in a list: its country abroad, else its VKN / TCKN. */
export const customerTag = (customer: Recipient) =>
  customer.taxIDOrTRID.trim() === FOREIGN_TAX_ID
    ? countryLabel(customer.country)
    : customer.taxIDOrTRID;

/** The country's English name in a list, when it differs from the Turkish one. */
export const countryHint = (country: CountryOption) =>
  country.en === country.label ? null : country.en;

const TAX_ID_HINTS: Record<TaxIDKind, string> = {
  foreign: 'Yurt dışındaki müşteri numarası',
  tckn: 'TCKN',
  undisclosed: 'TCKN vermeyen kişi',
  vkn: 'VKN',
};

/**
 * VKN / TCKN: digits only once pasted (spaces, dots and dashes go), a hint
 * naming what the number is once it checks out, and a shortcut for a person
 * who gives no TCKN. `children` go under it.
 */
export function TaxIDInput({
  children,
  error,
  id,
  onBlur,
  onValueChange,
  value,
}: {
  children?: ReactNode;
  error?: string | null | undefined;
  id: string;
  onBlur: () => void;
  onValueChange: (value: string) => void;
  value: string;
}) {
  const kind = taxIDKind(value);
  return (
    <div {...props(styles.stack)}>
      <FieldFrame
        description={kind ? TAX_ID_HINTS[kind] : 'Şirketse VKN, kişiyse TCKN'}
        error={error ?? undefined}
        id={id}
        label="VKN / TCKN"
      >
        {(describedBy) => (
          <div {...props(styles.inputWrap)}>
            <Input
              aria-describedby={describedBy}
              aria-invalid={error ? true : undefined}
              autoComplete="off"
              id={id}
              inputMode="numeric"
              name={id}
              onBlur={onBlur}
              onChange={(event) => onValueChange(normalizeTaxID(event.target.value))}
              placeholder="1234567890"
              spellCheck={false}
              style={[styles.tabular, kind && !error && styles.checked]}
              value={value}
            />
            {kind && !error && <CheckIcon aria-hidden {...props(styles.check)} />}
          </div>
        )}
      </FieldFrame>
      {!value && (
        <button
          onClick={() => onValueChange(UNDISCLOSED_TCKN)}
          type="button"
          {...props(styles.textAction)}
        >
          TCKN vermek istemiyor
        </button>
      )}
      {children}
    </div>
  );
}

export interface TextSuggestion {
  /** Muted text at the end of the row, e.g. an il. */
  hint?: string | null | undefined;
  id: string;
  label: string;
}

/**
 * Free text with suggestions (an il, a vergi dairesi): typing keeps whatever
 * is typed, a suggestion fills the field. `suggestions` are already matched to
 * the text; the one equal to it is left out.
 */
export function SuggestInput({
  describedBy,
  id,
  invalid,
  onBlur,
  onValueChange,
  placeholder,
  suggestions,
  value,
}: {
  describedBy?: string | undefined;
  id: string;
  invalid?: boolean | undefined;
  onBlur?: (() => void) | undefined;
  onValueChange: (value: string) => void;
  placeholder?: string | undefined;
  suggestions: ReadonlyArray<TextSuggestion>;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const typed = searchKey(value);
  const matches = suggestions.filter((suggestion) => searchKey(suggestion.label) !== typed);
  return (
    <Combobox
      filter={null}
      inputValue={value}
      items={matches}
      itemToStringLabel={(suggestion: TextSuggestion) => suggestion.label}
      onInputValueChange={(next, details) => {
        if (details.reason === 'input-change' || details.reason === 'item-press') {
          onValueChange(next);
        }
      }}
      onOpenChange={setOpen}
      open={open && matches.length > 0}
      value={null}
    >
      <ComboboxInput
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        id={id}
        onBlur={onBlur}
        placeholder={placeholder}
        showTrigger={false}
      />
      <ComboboxContent>
        <ComboboxList>
          {(suggestion: TextSuggestion) => (
            <ComboboxItem key={suggestion.id} value={suggestion}>
              <span {...props(styles.itemLabel)}>{suggestion.label}</span>
              {suggestion.hint && <span {...props(styles.hint)}>{suggestion.hint}</span>}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

/**
 * Ülke outside a form (Müşteriler), like Yeni fatura's ComboboxField: the
 * Turkish name shows, the English name and aliases match too, GİB's `value`
 * is stored, and it can be cleared.
 */
export function CountryCombobox({
  describedBy,
  id,
  invalid,
  onValueChange,
  value,
}: {
  describedBy?: string | undefined;
  id: string;
  invalid?: boolean | undefined;
  onValueChange: (value: string) => void;
  value: string;
}) {
  const selected = COUNTRY_OPTIONS.find((country) => country.value === value) ?? null;
  return (
    <Combobox
      filter={matchesCountry}
      isItemEqualToValue={(item: CountryOption, other: CountryOption) => item.value === other.value}
      items={COUNTRY_OPTIONS}
      itemToStringLabel={(country: CountryOption) => country.label}
      locale="tr"
      onValueChange={(country: CountryOption | null) => onValueChange(country?.value ?? '')}
      value={selected}
    >
      <ComboboxInput
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        id={id}
        onFocus={(event) => event.currentTarget.select()}
        placeholder="Ülke seç"
        showClear={selected !== null}
      />
      <ComboboxContent>
        <ComboboxEmpty>Ülke bulunamadı</ComboboxEmpty>
        <ComboboxList>
          {(country: CountryOption) => {
            const hint = countryHint(country);
            return (
              <ComboboxItem key={country.value} value={country}>
                <span {...props(styles.itemLabel)}>{country.label}</span>
                {hint && <span {...props(styles.hint)}>{hint}</span>}
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

/** Vergi dairesi suggestions from GİB's list: the il's own offices once Şehir names one. */
export const taxOfficeSuggestions = (query: string, city: string): Array<TextSuggestion> => {
  const inCity = cityCode(city) !== null;
  return suggestTaxOffices(query, city).map((office) => ({
    hint: inCity ? null : office.city,
    id: office.code,
    label: office.name,
  }));
};

/** Şehir suggestions: the 81 il, only for a customer in Türkiye. */
export const citySuggestions = (
  query: string,
  customer: Pick<Recipient, 'country' | 'taxIDOrTRID'>,
): Array<TextSuggestion> =>
  isForeignCustomer(customer)
    ? []
    : CITY_NAMES.filter((name) => matchesWords(query, name)).map((name) => ({
        id: name,
        label: name,
      }));

/**
 * "Yurt dışı müşteri": on, the VKN becomes GİB's 2222222222 and Vergi dairesi
 * goes away; the country must then be one abroad.
 */
export function ForeignCustomerSwitch({
  checked,
  id,
  onCheckedChange,
  style,
}: {
  checked: boolean;
  id: string;
  onCheckedChange: (checked: boolean) => void;
  style?: StyleXStyles;
}) {
  return (
    <div {...props(styles.switchRow, style)}>
      <label {...props(styles.switchLabel)}>
        <Switch
          aria-describedby={`${id}-description`}
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
        Yurt dışı müşteri
      </label>
      <FieldDescription id={`${id}-description`}>
        VKN yerine GİB’in yurt dışı numarası 2222222222 gider, vergi dairesi gerekmez.
      </FieldDescription>
    </div>
  );
}

/** A suggest field bound to the form: Vergi dairesi, Şehir. */
function BoundSuggestField({
  label,
  placeholder,
  suggestions,
}: {
  label: string;
  placeholder?: string;
  suggestions: (value: string) => ReadonlyArray<TextSuggestion>;
}) {
  const field = useFieldContext<string>();
  const error = useFieldError();
  return (
    <FieldFrame error={error} id={field.name} label={label}>
      {(describedBy) => (
        <SuggestInput
          describedBy={describedBy}
          id={field.name}
          invalid={error !== undefined}
          onBlur={field.handleBlur}
          onValueChange={field.handleChange}
          placeholder={placeholder}
          suggestions={suggestions(field.state.value)}
          value={field.state.value}
        />
      )}
    </FieldFrame>
  );
}

/**
 * VKN / TCKN bound to the form. A wrong number shows its error once the field
 * was left or the form submitted, not while it is typed; after that it follows
 * every keystroke, so a fix clears it at once.
 */
function BoundTaxIDField({ children }: { children?: ReactNode }) {
  const field = useFieldContext<string>();
  const submitted = useFormStore(field.form.store, (state) => state.submissionAttempts > 0);
  const error = field.state.meta.errors.find((item) => typeof item === 'string');
  const shown = field.state.meta.isBlurred || submitted;
  return (
    <TaxIDInput
      error={shown && typeof error === 'string' ? error : undefined}
      id={field.name}
      onBlur={field.handleBlur}
      onValueChange={field.handleChange}
      value={field.state.value}
    >
      {children}
    </TaxIDInput>
  );
}

type PickerItem = { customer: Recipient; kind: 'saved' } | { kind: 'new'; text: string };

/** A saved customer's name or VKN / TCKN; digits only match the VKN / TCKN. */
function matchesCustomer(customer: Recipient, query: string) {
  const digits = normalizeTaxID(query);
  return /^\d+$/.test(digits)
    ? customer.taxIDOrTRID.includes(digits)
    : matchesQuery(query, customer.title, customer.name, customer.surname, customer.taxIDOrTRID);
}

const pickerLabel = (item: PickerItem) =>
  item.kind === 'saved' ? displayName(item.customer) : item.text;

const BLANK_RECIPIENT: Recipient = {
  city: '',
  country: '',
  district: '',
  fullAddress: '',
  id: '',
  name: '',
  surname: '',
  taxIDOrTRID: '',
  taxOffice: '',
  title: '',
};

export function RecipientSection({ form, recipient }: { form: InvoiceForm; recipient: Recipient }) {
  const { savedRecipients } = useStore();
  const [query, setQuery] = useState('');
  const matched = findCustomer(savedRecipients, recipient.taxIDOrTRID, customerName(recipient));
  // The VKN typed belongs to a saved customer this form is not filled with.
  const known = matched ? null : findCustomerByTaxID(savedRecipients, recipient.taxIDOrTRID);
  const foreign = recipient.taxIDOrTRID.trim() === FOREIGN_TAX_ID;

  // The customer's defaults set more than the recipient. Their listeners stay
  // quiet: applyCustomer already resets a new currency's rate.
  const pickCustomer = (customer: Recipient) => {
    const next = applyCustomer(form.state.values, customer);
    form.setFieldValue('recipient', next.recipient, { dontRunListeners: true });
    form.setFieldValue('invoiceSettings', next.invoiceSettings, { dontRunListeners: true });
    form.setFieldValue('items', next.items, { dontRunListeners: true });
    form.setFieldValue('advancedFields', next.advancedFields, { dontRunListeners: true });
  };

  // A new customer from the picker's text: a name goes to Unvan, digits to
  // VKN / TCKN, and the form goes on with the other one. A saved customer's
  // details are cleared first; details typed by hand stay.
  const startCustomer = (text: string) => {
    const digits = normalizeTaxID(text);
    const isTaxID = /^\d+$/.test(digits);
    const base = matched ? BLANK_RECIPIENT : recipient;
    form.setFieldValue(
      'recipient',
      isTaxID ? { ...base, taxIDOrTRID: digits } : { ...base, title: text.trim() },
      { dontRunListeners: true },
    );
    const next = isTaxID ? 'recipient.title' : 'recipient.taxIDOrTRID';
    requestAnimationFrame(() => document.getElementById(next)?.focus());
  };

  const setForeign = (checked: boolean) => {
    if (!checked) {
      form.setFieldValue('recipient.taxIDOrTRID', '');
      return;
    }
    form.setFieldValue('recipient.taxIDOrTRID', FOREIGN_TAX_ID);
    form.setFieldValue('recipient.taxOffice', '');
    if (recipient.country === 'Türkiye') {
      form.setFieldValue('recipient.country', '', { dontUpdateMeta: true });
    }
  };

  const typed = query.trim();
  const typedKey = searchKey(typed);
  const exact = savedRecipients.some(
    (customer) =>
      searchKey(displayName(customer)) === typedKey ||
      customer.taxIDOrTRID === normalizeTaxID(typed),
  );
  const items: Array<PickerItem> = byRecentInvoice(savedRecipients).map((customer) => ({
    customer,
    kind: 'saved',
  }));
  if (typed && !exact) {
    items.push({ kind: 'new', text: typed });
  }

  return (
    <Section title="Müşteri">
      <Field>
        <FieldLabel htmlFor="customer-picker">Müşteri ara ya da yeni gir</FieldLabel>
        <Combobox
          autoHighlight
          filter={(item: PickerItem, text: string) =>
            item.kind === 'new' || matchesCustomer(item.customer, text)
          }
          isItemEqualToValue={(item: PickerItem, value: PickerItem) =>
            item.kind === 'saved' &&
            value.kind === 'saved' &&
            item.customer.id === value.customer.id
          }
          items={items}
          itemToStringLabel={pickerLabel}
          onInputValueChange={setQuery}
          onValueChange={(item: PickerItem | null) => {
            if (item?.kind === 'saved') {
              pickCustomer(item.customer);
            } else if (item?.kind === 'new') {
              startCustomer(item.text);
            }
          }}
          value={matched ? { customer: matched, kind: 'saved' } : null}
        >
          <ComboboxInput
            id="customer-picker"
            onFocus={(event) => event.currentTarget.select()}
            placeholder="Unvan, ad ya da VKN / TCKN"
          />
          <ComboboxContent>
            <ComboboxEmpty>
              {savedRecipients.length > 0
                ? 'Müşteri bulunamadı'
                : 'Henüz kayıtlı müşteri yok. Kestiğin her faturanın müşterisi burada olur.'}
            </ComboboxEmpty>
            <ComboboxList>
              {(item: PickerItem) =>
                item.kind === 'saved' ? (
                  <ComboboxItem key={item.customer.id} value={item}>
                    <span {...props(styles.itemLabel)}>{displayName(item.customer)}</span>
                    <span {...props(styles.hint)}>{customerTag(item.customer)}</span>
                  </ComboboxItem>
                ) : (
                  <ComboboxItem key="new" value={item}>
                    <PlusIcon aria-hidden {...props(styles.itemIcon)} />
                    <span {...props(styles.itemLabel)}>Yeni müşteri: {item.text}</span>
                  </ComboboxItem>
                )
              }
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </Field>
      <div {...props(sectionStyles.fields)}>
        <ForeignCustomerSwitch
          checked={foreign}
          id="recipient-foreign"
          onCheckedChange={setForeign}
          style={styles.fullRow}
        />
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
          {() => (
            <BoundTaxIDField>
              <p role="status" {...props(styles.status)}>
                {known && (
                  <>
                    Kayıtlı müşteri: <span {...props(styles.statusName)}>{displayName(known)}</span>
                    {' · '}
                    <button
                      onClick={() => pickCustomer(known)}
                      type="button"
                      {...props(styles.textAction, styles.textActionInline)}
                    >
                      Bilgilerini doldur
                    </button>
                  </>
                )}
              </p>
            </BoundTaxIDField>
          )}
        </form.AppField>
        {!foreign && (
          <form.AppField name="recipient.taxOffice">
            {() => (
              <BoundSuggestField
                label="Vergi dairesi"
                suggestions={(value) => taxOfficeSuggestions(value, recipient.city)}
              />
            )}
          </form.AppField>
        )}
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
          {() => (
            <BoundSuggestField
              label="Şehir"
              suggestions={(value) => citySuggestions(value, recipient)}
            />
          )}
        </form.AppField>
        <form.AppField name="recipient.country">
          {(field) => (
            <field.ComboboxField
              clearable
              emptyText="Ülke bulunamadı"
              filter={matchesCountry}
              items={COUNTRY_OPTIONS}
              label="Ülke"
              placeholder="Ülke seç"
              secondary={countryHint}
            />
          )}
        </form.AppField>
      </div>
    </Section>
  );
}
