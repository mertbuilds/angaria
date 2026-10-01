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
  Field,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { GIB_UNIT_TYPES } from '@/lib/gib-constants.ts';
import { useStore } from '@/lib/store.tsx';
import type { InvoiceItem } from '@/lib/types.ts';
import { ListDetail } from '@/shell/list-detail.tsx';
import { Screen } from '@/shell/screen.tsx';
import {
  EmptyState,
  formatMoney,
  formatNumber,
  matchesQuery,
  SearchableList,
  unitLabel,
  useDialogTarget,
  useListSelection,
} from '@/shell/searchable-list.tsx';

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

/**
 * "1.250,5" (Turkish) or "1250.5": with a comma, dots group thousands; without
 * one, a dot is the decimal point. Empty is 0, anything else unparsable null.
 */
function parseDecimal(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  const value = Number(
    trimmed.includes(',') ? trimmed.replaceAll('.', '').replace(',', '.') : trimmed,
  );
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * A number field that keeps what is typed ("12," on the way to "12,5") and
 * stores the parsed value on every valid keystroke.
 */
function NumberInput({
  blankZero = false,
  id,
  onValueChange,
  placeholder,
  value,
}: {
  /** Shows 0 as an empty field with the placeholder. */
  blankZero?: boolean;
  id: string;
  onValueChange: (value: number) => void;
  placeholder?: string;
  value: number;
}) {
  const [text, setText] = useState(() =>
    blankZero && value === 0 ? '' : String(value).replace('.', ','),
  );

  return (
    <Input
      aria-invalid={parseDecimal(text) === null}
      id={id}
      inputMode="decimal"
      onChange={(event) => {
        setText(event.target.value);
        const next = parseDecimal(event.target.value);
        if (next !== null) {
          onValueChange(next);
        }
      }}
      placeholder={placeholder}
      style={styles.number}
      value={text}
    />
  );
}

function ItemDetail({
  autoFocusName,
  item,
  nameRef,
  onChange,
  onDelete,
}: {
  autoFocusName: boolean;
  item: InvoiceItem;
  nameRef: RefObject<HTMLInputElement | null>;
  onChange: (patch: Partial<InvoiceItem>) => void;
  onDelete: () => void;
}) {
  const id = useId();

  return (
    <div {...props(styles.detail)}>
      <header {...props(styles.header)}>
        <div {...props(styles.titleBlock)}>
          <h2 {...props(styles.title)}>{item.name || 'Adsız kalem'}</h2>
          <p {...props(styles.subtitle)}>
            Değişiklikler kendiliğinden kaydedilir. Fatura keserken kalem adını seçince bu bilgiler
            gelir.
          </p>
        </div>
        <Button onClick={onDelete} variant="destructive">
          <Trash2Icon />
          Sil
        </Button>
      </header>

      <div {...props(styles.fields)}>
        <Field style={styles.fullRow}>
          <FieldLabel htmlFor={`${id}-name`}>Kalem adı</FieldLabel>
          <Input
            autoFocus={autoFocusName}
            id={`${id}-name`}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Yazılım geliştirme hizmeti"
            ref={nameRef}
            value={item.name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-quantity`}>Miktar</FieldLabel>
          <NumberInput
            id={`${id}-quantity`}
            onValueChange={(quantity) => onChange({ quantity })}
            value={item.quantity}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-unit`}>Birim</FieldLabel>
          <Select
            items={GIB_UNIT_TYPES}
            onValueChange={(unitType) => unitType && onChange({ unitType })}
            value={item.unitType}
          >
            <SelectTrigger id={`${id}-unit`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GIB_UNIT_TYPES.map((unit) => (
                <SelectItem key={unit.value} value={unit.value}>
                  {unit.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-price`}>Birim fiyat</FieldLabel>
          <NumberInput
            blankZero
            id={`${id}-price`}
            onValueChange={(unitPrice) => onChange({ unitPrice })}
            placeholder="0,00"
            value={item.unitPrice}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-vat`}>KDV oranı (%)</FieldLabel>
          <NumberInput
            id={`${id}-vat`}
            onValueChange={(VATRate) => onChange({ VATRate })}
            value={item.VATRate}
          />
        </Field>
      </div>
    </div>
  );
}

export function ItemTemplatesPage({ tabs }: { tabs: ReactNode }) {
  const { defaultItemAdvanced, newId, savedItems, setSavedItems } = useStore();
  const [query, setQuery] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const deleting = useDialogTarget<InvoiceItem>();

  const visible = useMemo(
    () => savedItems.filter((item) => matchesQuery(query, item.name)),
    [query, savedItems],
  );
  const { neighborOf, select, selected } = useListSelection(visible);

  const addItem = () => {
    const id = newId();
    setSavedItems((prev) => [
      ...prev,
      { id, name: '', quantity: 1, unitPrice: 0, VATRate: 20, ...defaultItemAdvanced },
    ]);
    setQuery('');
    setCreatedId(id);
    select(id);
  };

  const update = (id: string, patch: Partial<InvoiceItem>) =>
    setSavedItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const remove = () => {
    const id = deleting.target?.id;
    if (id) {
      select(neighborOf(id));
      setSavedItems((prev) => prev.filter((item) => item.id !== id));
      toast.success('Kalem şablonu silindi');
    }
    deleting.close();
  };

  const newItemButton = (variant: 'default' | 'outline') => (
    <Button onClick={addItem} variant={variant}>
      <PlusIcon />
      Yeni kalem
    </Button>
  );

  return (
    <Screen
      actions={savedItems.length > 0 && newItemButton('outline')}
      scroll={false}
      title="Şablonlar"
      toolbar={tabs}
    >
      {savedItems.length === 0 ? (
        <EmptyState action={newItemButton('default')} title="Henüz kalem şablonu yok">
          Fatura keserken yazdığınız kalemler burada kendiliğinden birikir. Sık kullandığınız bir
          hizmeti şimdiden de ekleyebilirsiniz.
        </EmptyState>
      ) : (
        <ListDetail
          detail={
            selected ? (
              <ItemDetail
                autoFocusName={selected.id === createdId}
                item={selected}
                key={selected.id}
                nameRef={nameRef}
                onChange={(patch) => update(selected.id, patch)}
                onDelete={() => deleting.show(selected)}
              />
            ) : (
              <p {...props(styles.placeholder)}>Aramayla eşleşen kalem yok</p>
            )
          }
          list={
            <SearchableList
              label="Kalem şablonları"
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
                subtitle: `${formatNumber(item.quantity)} ${unitLabel(item.unitType)} · KDV %${formatNumber(item.VATRate)}`,
                title: item.name || 'Adsız kalem',
                trailing: formatMoney(item.unitPrice),
              })}
              searchPlaceholder="Kalem ara"
              selected={selected}
              visible={visible}
            />
          }
          storageKey="sablonlar-list-width"
        />
      )}

      <AlertDialog onOpenChange={(open) => !open && deleting.close()} open={deleting.open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kalem silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting.target?.name || 'Adsız kalem'} kalem şablonlarından silinir. Bu işlem geri
              alınamaz.
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
