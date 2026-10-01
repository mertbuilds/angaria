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
  Textarea,
  toast,
} from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useNavigate } from '@tanstack/react-router';
import { FilePlusIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useId, useRef, useState, type RefObject } from 'react';
import { customerName, nameError, taxIDError } from '@/lib/customer.ts';
import { GIB_COUNTRIES } from '@/lib/gib-constants.ts';
import { isPDFLanguage, resolvePDFLanguage } from '@/lib/invoice-pdf-i18n.ts';
import { useStore } from '@/lib/store.tsx';
import type { Recipient } from '@/lib/types.ts';
import { ListDetail } from '@/shell/list-detail.tsx';
import { Screen } from '@/shell/screen.tsx';
import {
  EmptyState,
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
  placeholder: {
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    flex: 1,
    fontSize: font.sizeSm,
    justifyContent: 'center',
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

const displayName = (customer: Recipient) => customerName(customer) || 'Adsız müşteri';

const matchesCustomer = (customer: Recipient, query: string) =>
  matchesQuery(
    query,
    customer.title,
    customer.name,
    customer.surname,
    customer.taxIDOrTRID,
    customer.city,
  );

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
              placeholder="Ülke seçin"
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
        <Field>
          <FieldLabel htmlFor={`${id}-pdf-language`}>Varsayılan PDF dili</FieldLabel>
          <Select
            items={PDF_LANGUAGE_ITEMS}
            onValueChange={(language) =>
              isPDFLanguage(language) && onChange({ pdfLanguage: language })
            }
            value={resolvePDFLanguage(customer.pdfLanguage)}
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
      </div>
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
          Fatura kestiğiniz şirket ve kişileri bir kez kaydedin. Fatura keserken müşteriyi seçince
          bilgileri hazır gelir.
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
              {deleting.target && displayName(deleting.target)} müşterilerden silinir. Kesilmiş
              faturalar ve şablonlar etkilenmez. Bu işlem geri alınamaz.
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
