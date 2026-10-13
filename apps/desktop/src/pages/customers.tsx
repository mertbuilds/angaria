import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  ChoiceChips,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Field,
  FieldError,
  FieldLabel,
  FieldTitle,
  Input,
  NumberInput,
  Switch,
  Textarea,
  toast,
  type ChoiceOption,
} from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useNavigate } from '@tanstack/react-router';
import { FilePlusIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useId, useRef, useState, type RefObject } from 'react';
import { PDFLanguageToggle } from '@/components/pdf-language-toggle.tsx';
import { fullCountryName } from '@/lib/countries.ts';
import {
  countryError,
  customerDefaults,
  customerName,
  DEFAULT_DUE_DAYS,
  FOREIGN_TAX_ID,
  nameError,
  selfInvoiceWarning,
  taxIDError,
} from '@/lib/customer.ts';
import type { FieldOption } from '@/lib/fields/choice.tsx';
import { FieldFrame } from '@/lib/form-field.tsx';
import { CURRENCY_OPTIONS, customerDefaultsErrors } from '@/lib/invoice-form.ts';
import { SUPPORTED_INVOICE_TYPES, VAT_RATE_PRESETS } from '@/lib/regulated.ts';
import { useStore } from '@/lib/store.tsx';
import type { Recipient } from '@/lib/types.ts';
import { TAXPAYER_FILLED, useTaxpayerFill } from '@/lib/use-taxpayer-fill.ts';
import { ListDetail } from '@/shell/list-detail.tsx';
import { Screen } from '@/shell/screen.tsx';
import {
  EmptyState,
  invoiceTypeLabel,
  matchesQuery,
  SearchableList,
  useDialogTarget,
  useListSelection,
} from '@/shell/searchable-list.tsx';
import { VATRateInput } from './invoice-items.tsx';
import {
  citySuggestions,
  CountryCombobox,
  displayName,
  ForeignCustomerSwitch,
  SuggestInput,
  TaxIDInput,
  taxOfficeSuggestions,
} from './invoice-recipient.tsx';

const styles = create({
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  // Wide enough for three digits and the "gün" suffix.
  days: {
    width: '7rem',
  },
  dueRow: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s3,
    minHeight: '2.5rem',
  },
  detail: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s8,
    maxWidth: '40rem',
    padding: spacing.s6,
    width: '100%',
  },
  fields: {
    display: 'grid',
    gap: spacing.s4,
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  fullRow: {
    gridColumn: '1 / -1',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  // The input a Diğer chip shows, beside the chips.
  otherCurrency: {
    width: '14rem',
  },
  placeholder: {
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    flex: 1,
    fontSize: font.sizeSm,
    justifyContent: 'center',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  sectionTitle: {
    color: colors.fg,
    fontSize: font.sizeMd,
    fontWeight: font.weightMedium,
    margin: 0,
  },
  // A line under VKN / TCKN.
  status: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
  },
  subtitle: {
    color: colors.muted,
    fontSize: font.sizeSm,
    margin: 0,
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
  toggle: {
    alignSelf: 'flex-start',
  },
});

const COMMON_CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'];

const CURRENCY_CHOICES: ReadonlyArray<ChoiceOption<string>> = COMMON_CURRENCIES.map((code) => ({
  label: code,
  value: code,
}));

const OTHER_CURRENCIES = CURRENCY_OPTIONS.filter(
  (option) => !COMMON_CURRENCIES.includes(option.value),
);

const INVOICE_TYPE_CHOICES: ReadonlyArray<ChoiceOption<string>> = SUPPORTED_INVOICE_TYPES.map(
  (type) => ({ label: invoiceTypeLabel(type), value: type }),
);

/** The KDV choice for "no default": the rows keep their services' own rate. */
const SERVICE_RATE = 'service';

const VAT_CHOICES: ReadonlyArray<ChoiceOption<number | typeof SERVICE_RATE>> = [
  { label: 'Hizmetteki', value: SERVICE_RATE },
  ...VAT_RATE_PRESETS.map((rate) => ({ label: `%${rate}`, value: rate })),
];

const BLANK_CUSTOMER: Omit<Recipient, 'id'> = {
  city: '',
  country: '',
  district: '',
  fullAddress: '',
  name: '',
  surname: '',
  taxIDOrTRID: '',
  taxOffice: '',
  title: '',
};

const matchesCustomer = (customer: Recipient, query: string) =>
  matchesQuery(
    query,
    customer.title,
    customer.name,
    customer.surname,
    customer.taxIDOrTRID,
    customer.city,
  );

/** A whole number as typed ("14"), else null. */
const parseWhole = (text: string) => (/^\d{1,3}$/.test(text.trim()) ? Number(text.trim()) : null);

/**
 * A whole-number default (KDV oranı, days to pay) typed into a NumberInput.
 * A number in 0..`max` is saved as it is typed; anything else stays in the
 * field and shows `message` once the field was left, until it is fixed.
 */
function useWholeNumberInput(
  saved: number | undefined,
  max: number,
  message: string,
  save: (value: number) => void,
) {
  // What is typed while it cannot be saved; null shows the saved value.
  const [draft, setDraft] = useState<number | null>(null);
  const [blurred, setBlurred] = useState(false);
  const error = draft !== null && blurred ? message : null;
  return {
    error,
    reset: () => {
      setDraft(null);
      setBlurred(false);
    },
    input: {
      onBlur: () => setBlurred(true),
      onValueChange: (value: number) => {
        if (Number.isInteger(value) && value >= 0 && value <= max) {
          setDraft(null);
          save(value);
        } else {
          setDraft(value);
        }
      },
      value: draft ?? saved ?? Number.NaN,
    },
  };
}

/**
 * What an invoice for this customer starts with. The controls show the
 * defaults in effect, saved or derived from where the customer is.
 */
function CustomerDefaultsSection({
  customer,
  onChange,
}: {
  customer: Recipient;
  onChange: (patch: Partial<Recipient>) => void;
}) {
  const id = useId();
  const defaults = customerDefaults(customer);
  const defaultsErrors = customerDefaultsErrors(customer);
  const vatRate = useWholeNumberInput(
    customer.VATRate,
    100,
    'KDV oranını 0 ile 100 arasında tam sayı olarak yaz',
    (VATRate) => onChange({ VATRate }),
  );
  const dueDays = useWholeNumberInput(
    customer.dueDays,
    365,
    'Gün sayısını 0 ile 365 arasında tam sayı olarak yaz',
    (days) => onChange({ dueDays: days }),
  );

  return (
    <section {...props(styles.section)}>
      <div {...props(styles.titleBlock)}>
        <h3 {...props(styles.sectionTitle)}>Fatura varsayılanları</h3>
        <p {...props(styles.subtitle)}>
          Bu müşteriyi seçince fatura bunlarla başlar. Her faturadan sonra kendiliğinden
          güncellenir.
        </p>
      </div>
      <div {...props(styles.fields)}>
        <FieldFrame
          description={defaults.currency ? undefined : 'Seçilmezse faturanın para birimi kalır'}
          id={`${id}-currency`}
          label="Para birimi"
          style={styles.fullRow}
        >
          {(describedBy) => (
            <ChoiceChips
              aria-describedby={describedBy}
              aria-labelledby={`${id}-currency-label`}
              id={`${id}-currency`}
              onValueChange={(currency) => currency && onChange({ currency })}
              options={CURRENCY_CHOICES}
              other={{
                label: 'Diğer',
                render: ({ autoFocus, id: otherId }) => (
                  <div {...props(styles.otherCurrency)}>
                    <Combobox
                      isItemEqualToValue={(item: FieldOption, value: FieldOption) =>
                        item.value === value.value
                      }
                      items={OTHER_CURRENCIES}
                      locale="tr"
                      onValueChange={(option: FieldOption | null) =>
                        option && onChange({ currency: option.value })
                      }
                      value={
                        OTHER_CURRENCIES.find((option) => option.value === defaults.currency) ??
                        null
                      }
                    >
                      <ComboboxInput
                        aria-label="Diğer para birimi"
                        autoFocus={autoFocus}
                        id={otherId}
                        onFocus={(event) => event.currentTarget.select()}
                        placeholder="Para birimi ara"
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>Para birimi bulunamadı</ComboboxEmpty>
                        <ComboboxList>
                          {(option: FieldOption) => (
                            <ComboboxItem key={option.value} value={option}>
                              {option.label}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>
                ),
              }}
              value={defaults.currency ?? null}
            />
          )}
        </FieldFrame>
        <FieldFrame
          description={
            SUPPORTED_INVOICE_TYPES.includes(defaults.invoiceType)
              ? undefined
              : `Kayıtlı tip ${invoiceTypeLabel(defaults.invoiceType)}: Angaria bu tipi desteklemiyor. Satış ya da İstisna seç.`
          }
          id={`${id}-type`}
          label="Fatura tipi"
        >
          {(describedBy) => (
            <ChoiceChips
              aria-describedby={describedBy}
              aria-labelledby={`${id}-type-label`}
              id={`${id}-type`}
              onValueChange={(invoiceType) => invoiceType && onChange({ invoiceType })}
              options={INVOICE_TYPE_CHOICES}
              value={defaults.invoiceType}
            />
          )}
        </FieldFrame>
        <Field>
          <FieldTitle>PDF dili</FieldTitle>
          <PDFLanguageToggle
            onChange={(pdfLanguage) => onChange({ pdfLanguage })}
            style={styles.toggle}
            value={defaults.pdfLanguage}
          />
        </Field>
        <FieldFrame
          description="Hizmetteki: satırlar hizmetin kendi KDV oranıyla gelir"
          error={vatRate.error ?? defaultsErrors.VATRate}
          id={`${id}-vat`}
          label="KDV oranı"
          style={styles.fullRow}
        >
          {(describedBy) => (
            <ChoiceChips
              aria-describedby={describedBy}
              aria-invalid={vatRate.error || defaultsErrors.VATRate ? true : undefined}
              aria-labelledby={`${id}-vat-label`}
              id={`${id}-vat`}
              onValueChange={(rate) => {
                if (rate !== null) {
                  vatRate.reset();
                  onChange({ VATRate: rate === SERVICE_RATE ? undefined : rate });
                }
              }}
              options={VAT_CHOICES}
              other={{
                label: 'Diğer',
                render: ({ autoFocus, id: otherId }) => (
                  <VATRateInput
                    aria-describedby={describedBy}
                    aria-invalid={vatRate.error ? true : undefined}
                    aria-label="Diğer KDV oranı"
                    autoFocus={autoFocus}
                    id={otherId}
                    {...vatRate.input}
                  />
                ),
              }}
              value={customer.VATRate ?? SERVICE_RATE}
            />
          )}
        </FieldFrame>
        <FieldFrame
          description="Fatura tarihinden bu kadar gün sonrası PDF’e yazılır. GİB’e gönderilmez."
          error={dueDays.error ?? undefined}
          id={`${id}-due`}
          label="Son ödeme tarihi"
          style={styles.fullRow}
        >
          {(describedBy) => (
            <div {...props(styles.dueRow)}>
              <Switch
                aria-describedby={describedBy}
                checked={customer.dueDays !== undefined}
                id={`${id}-due`}
                onCheckedChange={(checked) => {
                  dueDays.reset();
                  onChange({ dueDays: checked ? DEFAULT_DUE_DAYS : undefined });
                }}
              />
              {customer.dueDays !== undefined && (
                <NumberInput
                  allowExpressions={false}
                  aria-describedby={describedBy}
                  aria-invalid={dueDays.error ? true : undefined}
                  aria-label="Kaç gün sonra"
                  format={String}
                  id={`${id}-due-days`}
                  max={365}
                  min={0}
                  parse={parseWhole}
                  style={styles.days}
                  suffix="gün"
                  {...dueDays.input}
                />
              )}
            </div>
          )}
        </FieldFrame>
      </div>
    </section>
  );
}

function CustomerDetail({
  autoFocusTitle,
  customer,
  onChange,
  onDelete,
  onIssue,
  titleRef,
}: {
  autoFocusTitle: boolean;
  customer: Recipient;
  onChange: (patch: Partial<Recipient>) => void;
  onDelete: () => void;
  onIssue: () => void;
  titleRef: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const { companyInfo } = useStore();
  // Errors show once a field was left, or right away for saved values, so a
  // new customer does not open covered in them.
  const [touched, setTouched] = useState(() => ({
    name: customerName(customer) !== '',
    taxID: customer.taxIDOrTRID !== '',
  }));
  const touch = (field: keyof typeof touched) =>
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  const taxIDProblem = touched.taxID ? taxIDError(customer.taxIDOrTRID) : null;
  const nameProblem = touched.name ? nameError(customer) : null;
  const countryProblem = countryError(customer);
  const foreign = customer.taxIDOrTRID.trim() === FOREIGN_TAX_ID;
  const fromRegistry = useTaxpayerFill(customer, onChange);

  const setForeign = (checked: boolean) =>
    onChange(
      checked
        ? {
            country: customer.country === 'Türkiye' ? '' : customer.country,
            taxIDOrTRID: FOREIGN_TAX_ID,
            taxOffice: '',
          }
        : { taxIDOrTRID: '' },
    );

  return (
    <div {...props(styles.detail)}>
      <header {...props(styles.header)}>
        <div {...props(styles.titleBlock)}>
          <h2 {...props(styles.title)}>{displayName(customer)}</h2>
          <p {...props(styles.subtitle)}>
            Değişiklikler kendiliğinden kaydedilir. Fatura keserken bu müşteriyi seçince bilgileri
            gelir.
          </p>
        </div>
        <div {...props(styles.actions)}>
          <Button onClick={onIssue}>
            <FilePlusIcon />
            Bu müşteriye fatura kes
          </Button>
          <Button onClick={onDelete} variant="destructive">
            <Trash2Icon />
            Sil
          </Button>
        </div>
      </header>

      <div {...props(styles.fields)}>
        <ForeignCustomerSwitch
          checked={foreign}
          id={`${id}-foreign`}
          onCheckedChange={setForeign}
          style={styles.fullRow}
        />
        <Field style={styles.fullRow}>
          <FieldLabel htmlFor={`${id}-title`}>Unvan</FieldLabel>
          <Input
            aria-describedby={nameProblem ? `${id}-name-error` : undefined}
            aria-invalid={nameProblem !== null}
            autoFocus={autoFocusTitle}
            id={`${id}-title`}
            onBlur={() => touch('name')}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="Örnek Teknoloji A.Ş."
            ref={titleRef}
            value={customer.title}
          />
          <FieldError id={`${id}-name-error`}>{nameProblem}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>Ad</FieldLabel>
          <Input
            id={`${id}-name`}
            onBlur={() => touch('name')}
            onChange={(event) => onChange({ name: event.target.value })}
            value={customer.name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-surname`}>Soyad</FieldLabel>
          <Input
            id={`${id}-surname`}
            onBlur={() => touch('name')}
            onChange={(event) => onChange({ surname: event.target.value })}
            value={customer.surname}
          />
        </Field>
        <TaxIDInput
          error={taxIDProblem}
          id={`${id}-tax-id`}
          onBlur={() => touch('taxID')}
          onValueChange={(taxIDOrTRID) => onChange({ taxIDOrTRID })}
          value={customer.taxIDOrTRID}
          warning={selfInvoiceWarning(customer.taxIDOrTRID, companyInfo.taxID)}
        >
          {fromRegistry && (
            <p role="status" {...props(styles.status)}>
              {TAXPAYER_FILLED}
            </p>
          )}
        </TaxIDInput>
        {!foreign && (
          <FieldFrame id={`${id}-tax-office`} label="Vergi dairesi">
            {(describedBy) => (
              <SuggestInput
                describedBy={describedBy}
                id={`${id}-tax-office`}
                onValueChange={(taxOffice) => onChange({ taxOffice })}
                suggestions={taxOfficeSuggestions(customer.taxOffice, customer.city)}
                value={customer.taxOffice}
              />
            )}
          </FieldFrame>
        )}
        <Field style={styles.fullRow}>
          <FieldLabel htmlFor={`${id}-address`}>Adres</FieldLabel>
          <Textarea
            id={`${id}-address`}
            onChange={(event) => onChange({ fullAddress: event.target.value })}
            placeholder="Cadde, sokak, bina ve kapı numarası"
            rows={3}
            value={customer.fullAddress}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-district`}>İlçe</FieldLabel>
          <Input
            id={`${id}-district`}
            onChange={(event) => onChange({ district: event.target.value })}
            value={customer.district}
          />
        </Field>
        <FieldFrame id={`${id}-city`} label="Şehir">
          {(describedBy) => (
            <SuggestInput
              describedBy={describedBy}
              id={`${id}-city`}
              onValueChange={(city) => onChange({ city })}
              suggestions={citySuggestions(customer.city, customer)}
              value={customer.city}
            />
          )}
        </FieldFrame>
        <FieldFrame error={countryProblem ?? undefined} id={`${id}-country`} label="Ülke">
          {(describedBy) => (
            <CountryCombobox
              describedBy={describedBy}
              id={`${id}-country`}
              invalid={countryProblem !== null}
              onValueChange={(country) => onChange({ country })}
              value={customer.country}
            />
          )}
        </FieldFrame>
      </div>

      <CustomerDefaultsSection customer={customer} onChange={onChange} />
    </div>
  );
}

export function CustomersPage() {
  const navigate = useNavigate();
  const { newId, savedRecipients, setSavedRecipients } = useStore();
  const [query, setQuery] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const deleting = useDialogTarget<Recipient>();

  const { neighborOf, select, selected, visible } = useListSelection(
    savedRecipients,
    query,
    matchesCustomer,
  );

  const addCustomer = () => {
    const id = newId();
    setSavedRecipients((prev) => [...prev, { ...BLANK_CUSTOMER, id }]);
    setQuery('');
    setCreatedId(id);
    select(id);
  };

  const update = (id: string, patch: Partial<Recipient>) =>
    setSavedRecipients((prev) =>
      prev.map((customer) => (customer.id === id ? { ...customer, ...patch } : customer)),
    );

  const issue = (customer: Recipient) =>
    void navigate({ search: { musteri: customer.id }, to: '/yeni' });

  const remove = () => {
    const id = deleting.target?.id;
    if (id) {
      select(neighborOf(id));
      setSavedRecipients((prev) => prev.filter((customer) => customer.id !== id));
      toast.success('Müşteri silindi');
    }
    deleting.close();
  };

  const newCustomerButton = (variant: 'default' | 'outline') => (
    <Button onClick={addCustomer} variant={variant}>
      <PlusIcon />
      Yeni müşteri
    </Button>
  );

  return (
    <Screen
      actions={savedRecipients.length > 0 && newCustomerButton('outline')}
      scroll={false}
      title="Müşteriler"
    >
      {savedRecipients.length === 0 ? (
        <EmptyState action={newCustomerButton('default')} title="Henüz müşteri yok">
          Kestiğin her faturanın müşterisi buraya kendiliğinden kaydedilir. Sonraki faturada
          müşteriyi seçmen yeter, bilgileri ve varsayılanları hazır gelir.
        </EmptyState>
      ) : (
        <ListDetail
          detail={
            selected ? (
              <CustomerDetail
                autoFocusTitle={selected.id === createdId}
                customer={selected}
                key={selected.id}
                onChange={(patch) => update(selected.id, patch)}
                onDelete={() => deleting.show(selected)}
                onIssue={() => issue(selected)}
                titleRef={titleRef}
              />
            ) : (
              <p {...props(styles.placeholder)}>Aramayla eşleşen müşteri yok</p>
            )
          }
          list={
            <SearchableList
              label="Müşteriler"
              onDelete={deleting.show}
              onOpen={(customer) => {
                select(customer.id);
                titleRef.current?.focus();
              }}
              onQueryChange={setQuery}
              onSelect={select}
              openHint="düzenle"
              query={query}
              row={(customer) => ({
                subtitle:
                  [customer.taxIDOrTRID, customer.city || fullCountryName(customer.country)]
                    .filter(Boolean)
                    .join(' · ') || 'VKN / TCKN eklenmedi',
                title: displayName(customer),
              })}
              searchPlaceholder="Müşteri ara"
              selected={selected}
              visible={visible}
            />
          }
          storageKey="musteriler-list-width"
        />
      )}

      <AlertDialog onOpenChange={(open) => !open && deleting.close()} open={deleting.open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Müşteri silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting.target && displayName(deleting.target)} müşterilerinden silinir. Kestiğin
              faturalar etkilenmez. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={remove} variant="destructive">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Screen>
  );
}
