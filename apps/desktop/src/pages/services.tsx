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
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  NumberInput,
  toast,
  type NumberInputProps,
} from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useId, useRef, useState, type RefObject } from 'react';
import { formatAmount, parseDecimal } from '@/lib/invoice-form.ts';
import { formatPrice, historyCurrency } from '@/lib/services.ts';
import { useStore } from '@/lib/store.tsx';
import type { Service } from '@/lib/types.ts';
import { ListDetail } from '@/shell/list-detail.tsx';
import { Screen } from '@/shell/screen.tsx';
import {
  EmptyState,
  formatNumber,
  matchesQuery,
  SearchableList,
  unitLabel,
  useDialogTarget,
  useListSelection,
} from '@/shell/searchable-list.tsx';
import { CURRENCY_CHOICES, OtherCurrency } from './invoice-header.tsx';
import {
  currencySymbol,
  UNIT_OPTIONS,
  UnitCombobox,
  VAT_OPTIONS,
  VATRateInput,
} from './invoice-items.tsx';

const styles = create({
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
    alignItems: 'flex-start',
    display: 'flex',
    gap: spacing.s4,
    justifyContent: 'space-between',
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

const quantityError = (value: number) =>
  !Number.isFinite(value)
    ? 'Miktarı rakamla yaz, örneğin 2 ya da 1,5'
    : value <= 0
      ? 'Miktar sıfırdan büyük olmalı'
      : undefined;

const unitPriceError = (value: number) =>
  !Number.isFinite(value)
    ? 'Birim fiyatı rakamla yaz, örneğin 1.250,50'
    : value < 0
      ? 'Birim fiyat sıfırdan küçük olamaz'
      : undefined;

const vatRateError = (value: number) =>
  Number.isInteger(value) && value >= 0 && value <= 100
    ? undefined
    : 'KDV oranı 0 ile 100 arasında tam sayı olmalı';

/**
 * A number of the service as typed: the field shows every keystroke, the
 * service keeps only a value `check` accepts. Its error shows once the field
 * was left, then follows every keystroke.
 */
function useCheckedNumber(
  saved: number,
  check: (value: number) => string | undefined,
  save: (value: number) => void,
) {
  const [value, setValue] = useState(saved);
  const [left, setLeft] = useState(false);
  return {
    error: left ? check(value) : undefined,
    onBlur: () => setLeft(true),
    onValueChange: (next: number) => {
      setValue(next);
      if (!check(next)) {
        save(next);
      }
    },
    value,
  };
}

function ServiceNumberField({
  check,
  id,
  label,
  onSave,
  value: saved,
  ...input
}: Omit<
  NumberInputProps,
  'aria-describedby' | 'aria-invalid' | 'id' | 'onBlur' | 'onValueChange' | 'parse' | 'value'
> & {
  check: (value: number) => string | undefined;
  id: string;
  label: string;
  onSave: (value: number) => void;
  value: number;
}) {
  const number = useCheckedNumber(saved, check, onSave);
  return (
    <Field data-invalid={number.error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NumberInput
        {...input}
        aria-describedby={number.error ? `${id}-error` : undefined}
        aria-invalid={number.error ? true : undefined}
        id={id}
        onBlur={number.onBlur}
        onValueChange={number.onValueChange}
        parse={parseDecimal}
        value={number.value}
      />
      {number.error && <FieldError id={`${id}-error`}>{number.error}</FieldError>}
    </Field>
  );
}

/** KDV as on Yeni fatura: the common rates as chips, Diğer for any whole rate. */
function ServiceVATField({
  id,
  onSave,
  value: saved,
}: {
  id: string;
  onSave: (value: number) => void;
  value: number;
}) {
  const rate = useCheckedNumber(saved, vatRateError, onSave);
  const describedBy = rate.error ? `${id}-error` : undefined;
  return (
    <Field data-invalid={rate.error ? true : undefined} style={styles.fullRow}>
      <FieldLabel htmlFor={id} id={`${id}-label`}>
        KDV
      </FieldLabel>
      <ChoiceChips
        aria-describedby={describedBy}
        aria-invalid={rate.error ? true : undefined}
        aria-labelledby={`${id}-label`}
        id={id}
        onValueChange={(next) => next !== null && rate.onValueChange(next)}
        options={VAT_OPTIONS}
        other={{
          label: 'Diğer',
          render: ({ autoFocus, id: otherId }) => (
            <VATRateInput
              aria-describedby={describedBy}
              aria-invalid={rate.error ? true : undefined}
              aria-labelledby={`${id}-label`}
              autoFocus={autoFocus}
              id={otherId}
              onBlur={rate.onBlur}
              onValueChange={rate.onValueChange}
              value={rate.value}
            />
          ),
        }}
        value={rate.value}
      />
      {rate.error && <FieldError id={`${id}-error`}>{rate.error}</FieldError>}
    </Field>
  );
}

const NO_CURRENCY = 'Para birimi yok';

/**
 * Para birimi as on Yeni fatura: the common currencies as chips, Diğer for
 * GİB's others. A service saved before services had a currency has none, and
 * says so until one is picked.
 */
function ServiceCurrencyField({
  id,
  onSave,
  value,
}: {
  id: string;
  onSave: (currency: string) => void;
  value: string | undefined;
}) {
  return (
    <Field style={styles.fullRow}>
      <FieldLabel htmlFor={id} id={`${id}-label`}>
        Para birimi
      </FieldLabel>
      <ChoiceChips
        aria-describedby={value ? undefined : `${id}-description`}
        aria-labelledby={`${id}-label`}
        id={id}
        onValueChange={(next) => next && onSave(next)}
        options={CURRENCY_CHOICES}
        other={{
          label: 'Diğer',
          render: ({ id: otherId }) => (
            <OtherCurrency id={otherId} onChange={onSave} value={value ?? ''} />
          ),
        }}
        value={value ?? null}
      />
      {!value && (
        <FieldDescription id={`${id}-description`}>
          {NO_CURRENCY}. Seçene kadar fiyat, kestiğin faturanın para biriminde sayılır.
        </FieldDescription>
      )}
    </Field>
  );
}

function ServiceDetail({
  autoFocusName,
  item,
  nameRef,
  onChange,
  onDelete,
}: {
  autoFocusName: boolean;
  item: Service;
  nameRef: RefObject<HTMLInputElement | null>;
  onChange: (patch: Partial<Service>) => void;
  onDelete: () => void;
}) {
  const id = useId();

  return (
    <div {...props(styles.detail)}>
      <header {...props(styles.header)}>
        <div {...props(styles.titleBlock)}>
          <h2 {...props(styles.title)}>{item.name || 'Adsız hizmet'}</h2>
          <p {...props(styles.subtitle)}>
            Değişiklikler kendiliğinden kaydedilir. Fatura keserken hizmetin adını seçince bu
            bilgiler gelir.
          </p>
        </div>
        <Button onClick={onDelete} variant="destructive">
          <Trash2Icon />
          Sil
        </Button>
      </header>

      <div {...props(styles.fields)}>
        <Field style={styles.fullRow}>
          <FieldLabel htmlFor={`${id}-name`}>Hizmet adı</FieldLabel>
          <Input
            autoFocus={autoFocusName}
            id={`${id}-name`}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Yazılım geliştirme hizmeti"
            ref={nameRef}
            value={item.name}
          />
        </Field>
        <ServiceNumberField
          check={quantityError}
          format={formatNumber}
          id={`${id}-quantity`}
          label="Miktar"
          min={0}
          onSave={(quantity) => onChange({ quantity })}
          steppers
          value={item.quantity}
        />
        <ServiceNumberField
          blankZero
          check={unitPriceError}
          format={formatAmount}
          id={`${id}-price`}
          label="Birim fiyat"
          min={0}
          onSave={(unitPrice) => onChange({ unitPrice })}
          placeholder="0,00"
          suffix={item.currency ? currencySymbol(item.currency) : undefined}
          value={item.unitPrice}
        />
        <ServiceCurrencyField
          id={`${id}-currency`}
          onSave={(currency) => onChange({ currency })}
          value={item.currency}
        />
        <Field style={styles.fullRow}>
          <FieldLabel htmlFor={`${id}-unit`} id={`${id}-unit-label`}>
            Birim
          </FieldLabel>
          <ChoiceChips
            aria-labelledby={`${id}-unit-label`}
            id={`${id}-unit`}
            onValueChange={(unitType) => unitType && onChange({ unitType })}
            options={UNIT_OPTIONS}
            other={{
              label: 'Diğer',
              render: ({ autoFocus, id: otherId }) => (
                <UnitCombobox
                  aria-labelledby={`${id}-unit-label`}
                  autoFocus={autoFocus}
                  id={otherId}
                  onValueChange={(unitType) => onChange({ unitType })}
                  value={item.unitType}
                />
              ),
            }}
            value={item.unitType}
          />
        </Field>
        <ServiceVATField
          id={`${id}-vat`}
          onSave={(VATRate) => onChange({ VATRate })}
          value={item.VATRate}
        />
      </div>
    </div>
  );
}

const matchesItem = (item: Service, query: string) => matchesQuery(query, item.name);

/**
 * Hizmetler: the saved service lines. Every invoice adds or updates them;
 * Yeni fatura suggests them by name.
 */
export function ServicesPage() {
  const { defaultItemAdvanced, newId, savedItems, savedRecipients, setSavedItems } = useStore();
  const [query, setQuery] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const deleting = useDialogTarget<Service>();

  const { neighborOf, select, selected, visible } = useListSelection(
    savedItems,
    query,
    matchesItem,
  );

  const addItem = () => {
    const id = newId();
    setSavedItems((prev) => [
      ...prev,
      {
        // The currency the invoices are in, when the customers agree on one.
        currency: historyCurrency(savedRecipients) ?? 'TRY',
        id,
        name: '',
        quantity: 1,
        unitPrice: 0,
        VATRate: 20,
        ...defaultItemAdvanced,
      },
    ]);
    setQuery('');
    setCreatedId(id);
    select(id);
  };

  const update = (id: string, patch: Partial<Service>) =>
    setSavedItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const remove = () => {
    const id = deleting.target?.id;
    if (id) {
      select(neighborOf(id));
      setSavedItems((prev) => prev.filter((item) => item.id !== id));
      toast.success('Hizmet silindi');
    }
    deleting.close();
  };

  const newItemButton = (variant: 'default' | 'outline') => (
    <Button onClick={addItem} variant={variant}>
      <PlusIcon />
      Yeni hizmet
    </Button>
  );

  return (
    <Screen
      actions={savedItems.length > 0 && newItemButton('outline')}
      scroll={false}
      title="Hizmetler"
    >
      {savedItems.length === 0 ? (
        <EmptyState action={newItemButton('default')} title="Henüz hizmet yok">
          Kestiğin faturalardaki hizmetler burada kendiliğinden birikir. Sık kullandığın bir hizmeti
          şimdiden de ekleyebilirsin.
        </EmptyState>
      ) : (
        <ListDetail
          detail={
            selected ? (
              <ServiceDetail
                autoFocusName={selected.id === createdId}
                item={selected}
                key={selected.id}
                nameRef={nameRef}
                onChange={(patch) => update(selected.id, patch)}
                onDelete={() => deleting.show(selected)}
              />
            ) : (
              <p {...props(styles.placeholder)}>Aramayla eşleşen hizmet yok</p>
            )
          }
          list={
            <SearchableList
              label="Hizmetler"
              onDelete={deleting.show}
              onOpen={(item) => {
                select(item.id);
                nameRef.current?.focus();
              }}
              onQueryChange={setQuery}
              onSelect={select}
              openHint="düzenle"
              query={query}
              row={(item) => ({
                subtitle: [
                  `${formatNumber(item.quantity)} ${unitLabel(item.unitType)}`,
                  `KDV %${formatNumber(item.VATRate)}`,
                  !item.currency && NO_CURRENCY,
                ]
                  .filter(Boolean)
                  .join(' · '),
                title: item.name || 'Adsız hizmet',
                trailing: formatPrice(item.unitPrice, item.currency),
              })}
              searchPlaceholder="Hizmet ara"
              selected={selected}
              visible={visible}
            />
          }
          storageKey="hizmetler-list-width"
        />
      )}

      <AlertDialog onOpenChange={(open) => !open && deleting.close()} open={deleting.open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hizmet silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting.target?.name || 'Adsız hizmet'} hizmetlerinden silinir. Kestiğin faturalar
              etkilenmez. Bu işlem geri alınamaz.
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
