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
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  toast,
} from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useNavigate } from '@tanstack/react-router';
import { FilePlusIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useId, useRef, useState, type RefObject } from 'react';
import { UNNAMED_CUSTOMER } from '@/lib/copy.ts';
import {
  customerDefaults,
  customerName,
  DEFAULT_DUE_DAYS,
  nameError,
  taxIDError,
} from '@/lib/customer.ts';
import type { FieldOption } from '@/lib/form.tsx';
import { GIB_COUNTRIES, GIB_INVOICE_TYPES } from '@/lib/gib-constants.ts';
import { CURRENCY_OPTIONS, parseDecimal } from '@/lib/invoice-form.ts';
import { isPDFLanguage } from '@/lib/invoice-pdf-i18n.ts';
import { useStore } from '@/lib/store.tsx';
import type { Recipient } from '@/lib/types.ts';
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

const styles = create({
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  days: {
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
    width: '5rem',
  },
  dueRow: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s3,
    minHeight: '2.5rem',
  },
  dueUnit: {
    color: colors.muted,
    fontSize: font.sizeSm,
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
  number: {
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
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
});

// GİB's list carries Faroe Adaları twice.
const COUNTRIES = [...new Set(GIB_COUNTRIES.map((country) => country.value))];

const PDF_LANGUAGE_ITEMS = [
  { label: 'Türkçe', value: 'tr' },
  { label: 'İngilizce', value: 'en' },
  { label: 'Türkçe ve İngilizce', value: 'both' },
];

const INVOICE_TYPE_ITEMS = GIB_INVOICE_TYPES.map((type) => ({
  label: invoiceTypeLabel(type.value),
  value: type.value,
}));

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

const displayName = (customer: Recipient) => customerName(customer) || UNNAMED_CUSTOMER;

const matchesCustomer = (customer: Recipient, query: string) =>
  matchesQuery(
    query,
    customer.title,
    customer.name,
    customer.surname,
    customer.taxIDOrTRID,
    customer.city,
  );

/** A whole number of days, kept as typed while it is being edited. */
function DaysInput({
  id,
  onValueChange,
  value,
}: {
  id: string;
  onValueChange: (days: number) => void;
  value: number;
}) {
  const [text, setText] = useState(String(value));
  return (
    <Input
      aria-invalid={!/^\d{1,3}$/.test(text)}
      aria-label="Kaç gün sonra"
      id={id}
      inputMode="numeric"
      maxLength={3}
      onBlur={() => setText(String(value))}
      onChange={(event) => {
        setText(event.target.value);
        if (/^\d{1,3}$/.test(event.target.value)) {
          onValueChange(Number(event.target.value));
        }
      }}
      style={styles.days}
      value={text}
    />
  );
}

/** KDV oranı: empty means no default, so the rows keep their own rate. */
function VATRateInput({
  id,
  onValueChange,
  value,
}: {
  id: string;
  onValueChange: (rate: number | undefined) => void;
  value: number | undefined;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value).replace('.', ','));
  const parsed = parseDecimal(text);
  return (
    <Input
      aria-describedby={`${id}-hint`}
      aria-invalid={parsed === null || parsed > 100}
      id={id}
      inputMode="decimal"
      onChange={(event) => {
        setText(event.target.value);
        const rate = parseDecimal(event.target.value);
        if (!event.target.value.trim()) {
          onValueChange(undefined);
        } else if (rate !== null && rate <= 100) {
          onValueChange(rate);
        }
      }}
      placeholder="Hizmetlerdeki gibi"
      style={styles.number}
      value={text}
    />
  );
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
  const currency = CURRENCY_OPTIONS.find((option) => option.value === defaults.currency) ?? null;

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
        <Field>
          <FieldLabel htmlFor={`${id}-currency`}>Para birimi</FieldLabel>
          <Combobox
            isItemEqualToValue={(item: FieldOption, value: FieldOption) =>
              item.value === value.value
            }
            items={CURRENCY_OPTIONS}
            locale="tr"
            onValueChange={(option: FieldOption | null) => onChange({ currency: option?.value })}
            value={currency}
          >
            <ComboboxInput
              id={`${id}-currency`}
              onFocus={(event) => event.currentTarget.select()}
              placeholder="Faturadaki gibi"
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
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-type`}>Fatura tipi</FieldLabel>
          <Select
            items={INVOICE_TYPE_ITEMS}
            onValueChange={(invoiceType) => invoiceType && onChange({ invoiceType })}
            value={defaults.invoiceType}
          >
            <SelectTrigger id={`${id}-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVOICE_TYPE_ITEMS.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-vat`}>KDV oranı (%)</FieldLabel>
          <VATRateInput
            id={`${id}-vat`}
            onValueChange={(VATRate) => onChange({ VATRate })}
            value={customer.VATRate}
          />
          <FieldDescription id={`${id}-vat-hint`}>
            Boşsa hizmetlerin KDV oranı değişmez
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-pdf-language`}>PDF dili</FieldLabel>
          <Select
            items={PDF_LANGUAGE_ITEMS}
            onValueChange={(language) =>
              isPDFLanguage(language) && onChange({ pdfLanguage: language })
            }
            value={defaults.pdfLanguage}
          >
            <SelectTrigger id={`${id}-pdf-language`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PDF_LANGUAGE_ITEMS.map((language) => (
                <SelectItem key={language.value} value={language.value}>
                  {language.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field style={styles.fullRow}>
          <FieldLabel htmlFor={`${id}-due`}>Son ödeme tarihi</FieldLabel>
          <div {...props(styles.dueRow)}>
            <Switch
              checked={customer.dueDays !== undefined}
              id={`${id}-due`}
              onCheckedChange={(checked) =>
                onChange({ dueDays: checked ? DEFAULT_DUE_DAYS : undefined })
              }
            />
            {customer.dueDays !== undefined && (
              <>
                <DaysInput
                  id={`${id}-due-days`}
                  onValueChange={(dueDays) => onChange({ dueDays })}
                  value={customer.dueDays}
                />
                <span {...props(styles.dueUnit)}>gün sonra</span>
              </>
            )}
          </div>
          <FieldDescription>
            Fatura tarihinden bu kadar gün sonrası PDF’e yazılır. GİB’e gönderilmez.
          </FieldDescription>
        </Field>
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
        <Field>
          <FieldLabel htmlFor={`${id}-tax-id`}>VKN / TCKN</FieldLabel>
          <Input
            aria-describedby={`${id}-tax-id-hint`}
            aria-invalid={taxIDProblem !== null}
            id={`${id}-tax-id`}
            inputMode="numeric"
            maxLength={11}
            onBlur={() => touch('taxID')}
            onChange={(event) => onChange({ taxIDOrTRID: event.target.value })}
            placeholder="1234567890"
            value={customer.taxIDOrTRID}
          />
          {taxIDProblem ? (
            <FieldError id={`${id}-tax-id-hint`}>{taxIDProblem}</FieldError>
          ) : (
            <FieldDescription id={`${id}-tax-id-hint`}>
              Yurt dışındaki müşteri için 2222222222
            </FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-tax-office`}>Vergi dairesi</FieldLabel>
          <Input
            id={`${id}-tax-office`}
            onChange={(event) => onChange({ taxOffice: event.target.value })}
            value={customer.taxOffice}
          />
        </Field>
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
        <Field>
          <FieldLabel htmlFor={`${id}-city`}>Şehir</FieldLabel>
          <Input
            id={`${id}-city`}
            onChange={(event) => onChange({ city: event.target.value })}
            value={customer.city}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-country`}>Ülke</FieldLabel>
          <Combobox
            items={COUNTRIES}
            onValueChange={(country: string | null) => onChange({ country: country ?? '' })}
            value={customer.country || null}
          >
            <ComboboxInput
              id={`${id}-country`}
              onFocus={(event) => event.currentTarget.select()}
              placeholder="Ülke seç"
            />
            <ComboboxContent>
              <ComboboxEmpty>Ülke bulunamadı</ComboboxEmpty>
              <ComboboxList>
                {(country: string) => (
                  <ComboboxItem key={country} value={country}>
                    {country}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </Field>
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
                  [customer.taxIDOrTRID, customer.city || customer.country]
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
