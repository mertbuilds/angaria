import {
  Button,
  ChoiceChips,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Kbd,
  NumberInput,
  type ChoiceOption,
  type NumberInputProps,
} from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useStore as useFormState } from '@tanstack/react-form';
import { ChevronRightIcon, PlusIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { GIB_UNIT_TYPES } from '@/lib/gib-constants.ts';
import {
  discountForRate,
  formatAmount,
  formatDecimal,
  invoiceWarnings,
  lineTotals,
  parseDecimal,
} from '@/lib/invoice-form.ts';
import { COMMON_UNITS, VAT_RATE_PRESETS } from '@/lib/regulated.ts';
import { useStore } from '@/lib/store.tsx';
import { GTIP_MASK } from '@/lib/tr-validators.ts';
import type { InvoiceItem } from '@/lib/types.ts';
import { formatMoney, formatNumber, matchesQuery, unitLabel } from '@/shell/searchable-list.tsx';
import { tones } from '../shell/palette.stylex.ts';
import type { InvoiceForm } from './use-invoice-form.ts';

const isMac = navigator.userAgent.includes('Mac');

const styles = create({
  addRow: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s3,
    justifyContent: 'space-between',
    paddingTop: spacing.s3,
  },
  amount: {
    alignItems: 'flex-end',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    marginInlineStart: 'auto',
    minWidth: 0,
  },
  amountLabel: {
    color: colors.muted,
    fontSize: font.sizeXs,
    lineHeight: 1.375,
  },
  amountValue: {
    alignItems: 'center',
    color: colors.fg,
    display: 'flex',
    fontSize: font.sizeSm,
    fontVariantNumeric: 'tabular-nums',
    height: '2.5rem',
    whiteSpace: 'nowrap',
  },
  amountVAT: {
    color: colors.muted,
    fontSize: font.sizeXs,
    fontVariantNumeric: 'tabular-nums',
    marginTop: `calc(-1 * ${spacing.s2})`,
    whiteSpace: 'nowrap',
  },
  body: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: spacing.s4,
    minWidth: 0,
  },
  // Beside an input, below its compact label: the same 40px line.
  besideInput: {
    alignItems: 'center',
    display: 'flex',
    height: '2.5rem',
    marginTop: '1.25rem',
  },
  choices: {
    alignItems: 'flex-start',
    columnGap: spacing.s6,
    display: 'flex',
    flexWrap: 'wrap',
    rowGap: spacing.s3,
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  discountFields: {
    alignItems: 'flex-start',
    columnGap: spacing.s2,
    display: 'flex',
    flexWrap: 'wrap',
    rowGap: spacing.s3,
  },
  discountReason: {
    flex: '1 1 14rem',
    minWidth: 0,
  },
  discountValue: {
    width: '10rem',
  },
  gtip: {
    width: '13rem',
  },
  // Sits beside the name input, below its label.
  gutter: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    height: '2.5rem',
    justifyContent: 'center',
    marginTop: '1.25rem',
  },
  hint: {
    alignItems: 'center',
    color: colors.muted,
    columnGap: spacing.s3,
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: font.sizeXs,
    rowGap: spacing.s1,
  },
  hintItem: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: spacing.s1,
  },
  index: {
    color: colors.muted,
    fontSize: font.sizeXs,
    fontVariantNumeric: 'tabular-nums',
    width: '1.25rem',
  },
  line: {
    alignItems: 'flex-start',
    columnGap: spacing.s2,
    display: 'flex',
    flexWrap: 'wrap',
    rowGap: spacing.s3,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  price: {
    flex: '0 1 14rem',
    minWidth: '9rem',
  },
  quantity: {
    flexShrink: 0,
    width: '8.5rem',
  },
  row: {
    borderTopColor: tones.divider,
    borderTopStyle: 'solid',
    borderTopWidth: {
      ':first-child': 0,
      default: '1px',
    },
    display: 'flex',
    gap: spacing.s2,
    paddingBlock: spacing.s4,
  },
  summary: {
    '::-webkit-details-marker': {
      display: 'none',
    },
    alignItems: 'center',
    borderRadius: '4px',
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'inline-flex',
    fontSize: font.sizeXs,
    gap: spacing.s1,
    listStyle: 'none',
    outline: {
      ':focus-visible': `1px solid ${tones.ring}`,
      default: 'none',
    },
    outlineOffset: '2px',
    userSelect: 'none',
    width: 'fit-content',
  },
  summaryIcon: {
    height: '0.875rem',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '150ms',
    },
    transitionProperty: 'transform',
    width: '0.875rem',
  },
  summaryIconOpen: {
    transform: 'rotate(90deg)',
  },
  unit: {
    width: 'auto',
  },
  unitCode: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: font.sizeXs,
    marginInlineStart: 'auto',
  },
  unitOther: {
    width: '10rem',
  },
  vat: {
    flex: '1 1 16rem',
    minWidth: 0,
  },
  vatOther: {
    width: '5.5rem',
  },
});

/** KDV's chips: %20, %10, %1 and %0. Diğer takes any whole rate. */
export const VAT_OPTIONS: ReadonlyArray<ChoiceOption<number>> = VAT_RATE_PRESETS.map((rate) => ({
  label: `%${rate}`,
  value: rate,
}));

/** Birim's chips: Adet, Saat, Gün and Ay. Diğer finds any GİB unit. */
export const UNIT_OPTIONS: ReadonlyArray<ChoiceOption<string>> = COMMON_UNITS.map((code) => ({
  label: unitLabel(code),
  value: code,
}));

/** A rate typed with or without its sign: "18", "%18" and "18%" are 18. */
const parsePercent = (text: string) => parseDecimal(text.replace('%', ''));

const currencySymbols = new Map<string, string>();

/** ₺ for TRY, $ for USD; the code itself when Intl has no symbol for it. */
function currencySymbol(currency: string) {
  let symbol = currencySymbols.get(currency);
  if (symbol === undefined) {
    try {
      symbol =
        new Intl.NumberFormat('tr-TR', {
          currency,
          currencyDisplay: 'narrowSymbol',
          style: 'currency',
        })
          .formatToParts(0)
          .find((part) => part.type === 'currency')?.value ?? currency;
    } catch {
      symbol = currency;
    }
    currencySymbols.set(currency, symbol);
  }
  return symbol;
}

/** KDV's Diğer input: a whole rate from 0 to 100, with or without %. */
export function VATRateInput(
  inputProps: Omit<
    NumberInputProps,
    'allowExpressions' | 'format' | 'max' | 'min' | 'onFocus' | 'parse' | 'style' | 'suffix'
  >,
) {
  return (
    <NumberInput
      {...inputProps}
      allowExpressions={false}
      format={formatDecimal}
      max={100}
      min={0}
      // Picking Diğer focuses the field on the rate so far: typing replaces it.
      onFocus={(event) => event.currentTarget.select()}
      parse={parsePercent}
      style={styles.vatOther}
      suffix="%"
    />
  );
}

type Unit = (typeof GIB_UNIT_TYPES)[number];

const matchesUnit = (unit: Unit, query: string) => matchesQuery(query, unit.label, unit.value);

/** Birim's Diğer input: any GİB unit, found by its name or its code. */
export function UnitCombobox({
  'aria-labelledby': labelledBy,
  autoFocus,
  id,
  onValueChange,
  value,
}: {
  'aria-labelledby': string;
  autoFocus: boolean;
  id: string;
  onValueChange: (code: string) => void;
  value: string;
}) {
  const selected = GIB_UNIT_TYPES.find((unit) => unit.value === value) ?? null;
  return (
    <div {...props(styles.unitOther)}>
      <Combobox
        filter={matchesUnit}
        isItemEqualToValue={(item: Unit, other: Unit) => item.value === other.value}
        items={GIB_UNIT_TYPES}
        itemToStringLabel={(unit: Unit) => unit.label}
        locale="tr"
        onValueChange={(unit: Unit | null) => unit && onValueChange(unit.value)}
        value={selected}
      >
        <ComboboxInput
          aria-labelledby={labelledBy}
          autoFocus={autoFocus}
          id={id}
          onFocus={(event) => event.currentTarget.select()}
          placeholder="Birim ara"
        />
        <ComboboxContent>
          <ComboboxEmpty>Birim bulunamadı</ComboboxEmpty>
          <ComboboxList>
            {(unit: Unit) => (
              <ComboboxItem key={unit.value} value={unit}>
                {unit.label}
                <span {...props(styles.unitCode)}>{unit.value}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

const hasDiscount = (item: InvoiceItem) =>
  Boolean(item.discountRate || item.discountAmount || item.discountReason);

type DiscountKind = 'amount' | 'percent';

/** The kind a row's discount values show, or null while both are 0. */
const discountKindOf = (item: InvoiceItem): DiscountKind | null =>
  (item.discountRate ?? 0) !== 0 ? 'percent' : (item.discountAmount ?? 0) !== 0 ? 'amount' : null;

/** A percentage for the discount's counterpart: "%10" or "%12,5". */
const percentFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

const at = <K extends keyof InvoiceItem>(index: number, key: K) =>
  `items[${index}].${key}` as const;

function ItemRow({
  canRemove,
  currency,
  form,
  index,
  item,
  onRemove,
}: {
  canRemove: boolean;
  currency: string;
  form: InvoiceForm;
  index: number;
  item: InvoiceItem;
  onRemove: () => void;
}) {
  const { defaultItemAdvanced, savedItems } = useStore();
  const istisna = useFormState(
    form.store,
    (state) => state.values.invoiceSettings.invoiceType === 'ISTISNA',
  );
  const vatWarning = useFormState(
    form.store,
    (state) => invoiceWarnings(state.values)[at(index, 'VATRate')],
  );
  const [discountOpen, setDiscountOpen] = useState(() => hasDiscount(item));
  const line = lineTotals(item);
  const symbol = currencySymbol(currency);

  // The discount is typed as a rate or as an amount; the values pick the kind
  // once one is set, the chips while both are 0.
  const valueKind = discountKindOf(item);
  const [discountKind, setDiscountKind] = useState<DiscountKind>(valueKind ?? 'percent');
  if (valueKind && valueKind !== discountKind) {
    setDiscountKind(valueKind);
  }

  const suggestions = useMemo(
    () =>
      savedItems
        .filter((saved) => saved.name.trim())
        .map((saved) => ({
          hint: `${formatMoney(saved.unitPrice)} · ${unitLabel(saved.unitType)} · %${formatNumber(saved.VATRate)}`,
          id: saved.id,
          label: saved.name,
        })),
    [savedItems],
  );

  // The amount follows the rate while one is set; typing an amount drops it.
  const recomputeDiscount = () => {
    const current = form.getFieldValue(`items[${index}]`);
    if (current.discountRate > 0) {
      form.setFieldValue(
        at(index, 'discountAmount'),
        discountForRate(current, current.discountRate),
        {
          dontRunListeners: true,
        },
      );
    }
  };

  const switchDiscountKind = (next: DiscountKind | null) => {
    if (!next || next === discountKind) {
      return;
    }
    const current = form.getFieldValue(`items[${index}]`);
    if (next === 'amount') {
      // The amount stays, and no longer follows the price.
      form.setFieldValue(at(index, 'discountRate'), 0, { dontRunListeners: true });
    } else {
      // The rate the amount comes to, to two decimals; the amount follows it.
      const { gross } = lineTotals(current);
      const amount = Number.isFinite(current.discountAmount) ? current.discountAmount : 0;
      const rate = gross > 0 ? Math.round((amount / gross) * 10_000) / 100 : 0;
      form.setFieldValue(at(index, 'discountRate'), rate, { dontRunListeners: true });
      form.setFieldValue(at(index, 'discountAmount'), discountForRate(current, rate), {
        dontRunListeners: true,
      });
    }
    setDiscountKind(next);
  };

  const discountCounterpart =
    line.gross > 0 && line.discount > 0
      ? discountKind === 'percent'
        ? `= ${formatMoney(line.discount, currency)}`
        : `= %${percentFormat.format((line.discount / line.gross) * 100)}`
      : undefined;

  return (
    <>
      <span {...props(styles.gutter, styles.index)}>{index + 1}</span>
      <div {...props(styles.body)}>
        <form.AppField name={at(index, 'name')}>
          {(field) => (
            <field.SuggestField
              compact
              label="Hizmet adı"
              onPick={(suggestion) => {
                const saved = savedItems.find((candidate) => candidate.id === suggestion.id);
                if (saved) {
                  form.setFieldValue(`items[${index}]`, {
                    ...defaultItemAdvanced,
                    ...saved,
                    id: item.id,
                  });
                }
              }}
              placeholder="Yazılım geliştirme hizmeti"
              suggestions={suggestions}
            />
          )}
        </form.AppField>
        <div {...props(styles.line)}>
          <form.AppField listeners={{ onChange: recomputeDiscount }} name={at(index, 'quantity')}>
            {(field) => (
              <field.NumberField
                compact
                format={formatNumber}
                label="Miktar"
                min={0}
                step={1}
                steppers
                style={styles.quantity}
              />
            )}
          </form.AppField>
          <form.AppField listeners={{ onChange: recomputeDiscount }} name={at(index, 'unitPrice')}>
            {(field) => (
              <field.NumberField
                blankZero
                compact
                format={formatAmount}
                label="Birim fiyat"
                min={0}
                placeholder="0,00"
                style={styles.price}
                suffix={symbol}
              />
            )}
          </form.AppField>
          <div {...props(styles.amount)}>
            <span {...props(styles.amountLabel)}>Tutar</span>
            <span {...props(styles.amountValue)}>{formatMoney(line.net, currency)}</span>
            <span {...props(styles.amountVAT)}>+ {formatMoney(line.vat, currency)} KDV</span>
          </div>
        </div>
        <div {...props(styles.choices)}>
          <form.AppField name={at(index, 'unitType')}>
            {(field) => (
              <field.ChoiceField
                compact
                label="Birim"
                options={UNIT_OPTIONS}
                other={{
                  label: 'Diğer',
                  render: ({ autoFocus, id }) => (
                    <UnitCombobox
                      aria-labelledby={`${field.name}-label`}
                      autoFocus={autoFocus}
                      id={id}
                      onValueChange={field.handleChange}
                      value={field.state.value}
                    />
                  ),
                }}
                size="sm"
                style={styles.unit}
              />
            )}
          </form.AppField>
          <form.AppField name={at(index, 'VATRate')}>
            {(field) => (
              <field.ChoiceField
                compact
                description={istisna ? 'İstisna faturada KDV %0' : undefined}
                disabled={istisna}
                label="KDV"
                options={VAT_OPTIONS}
                other={{
                  label: 'Diğer',
                  render: (input) => (
                    <VATRateInput
                      {...input}
                      aria-labelledby={`${field.name}-label`}
                      disabled={istisna}
                      onBlur={field.handleBlur}
                      onValueChange={field.handleChange}
                      value={field.state.value}
                    />
                  ),
                }}
                size="sm"
                style={styles.vat}
                warning={vatWarning}
              />
            )}
          </form.AppField>
        </div>
        {(istisna || item.gtip) && (
          <form.AppField name={at(index, 'gtip')}>
            {(field) => (
              <field.MaskedField
                compact
                description="Yalnızca mal ihracatında gerekir"
                inputMode="numeric"
                isValid={(value) => value.replaceAll(/\D/g, '').length === 12}
                label="GTİP"
                mask={GTIP_MASK}
                placeholder="0000.00.00.00.00"
                style={styles.gtip}
              />
            )}
          </form.AppField>
        )}
        <details
          onToggle={(event) => setDiscountOpen(event.currentTarget.open)}
          open={discountOpen}
          {...props(styles.details)}
        >
          <summary {...props(styles.summary)}>
            <ChevronRightIcon
              aria-hidden
              {...props(styles.summaryIcon, discountOpen && styles.summaryIconOpen)}
            />
            İskonto
          </summary>
          <div {...props(styles.discountFields)}>
            {discountKind === 'percent' ? (
              <form.AppField
                key="rate"
                listeners={{
                  onChange: ({ value }) => {
                    if (Number.isFinite(value)) {
                      const current = form.getFieldValue(`items[${index}]`);
                      form.setFieldValue(
                        at(index, 'discountAmount'),
                        discountForRate(current, value),
                        { dontRunListeners: true },
                      );
                    }
                  },
                }}
                name={at(index, 'discountRate')}
              >
                {(field) => (
                  <field.NumberField
                    blankZero
                    compact
                    description={discountCounterpart}
                    format={formatNumber}
                    label="İskonto oranı"
                    max={100}
                    min={0}
                    placeholder="0"
                    style={styles.discountValue}
                    suffix="%"
                  />
                )}
              </form.AppField>
            ) : (
              <form.AppField
                key="amount"
                listeners={{
                  onChange: () =>
                    form.setFieldValue(at(index, 'discountRate'), 0, { dontRunListeners: true }),
                }}
                name={at(index, 'discountAmount')}
              >
                {(field) => (
                  <field.NumberField
                    blankZero
                    compact
                    description={discountCounterpart}
                    format={formatAmount}
                    label="İskonto tutarı"
                    min={0}
                    placeholder="0,00"
                    style={styles.discountValue}
                    suffix={symbol}
                  />
                )}
              </form.AppField>
            )}
            <div {...props(styles.besideInput)}>
              <ChoiceChips
                aria-label="İskonto türü"
                onValueChange={switchDiscountKind}
                options={[
                  { description: 'Oran', label: '%', value: 'percent' },
                  { description: 'Tutar', label: symbol, value: 'amount' },
                ]}
                size="sm"
                value={discountKind}
              />
            </div>
            <form.AppField name={at(index, 'discountReason')}>
              {(field) => (
                <field.TextField compact label="İskonto nedeni" style={styles.discountReason} />
              )}
            </form.AppField>
          </div>
        </details>
      </div>
      <div {...props(styles.gutter)}>
        <Button
          aria-label={`${index + 1}. hizmeti sil`}
          disabled={!canRemove}
          onClick={onRemove}
          size="icon"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </div>
    </>
  );
}

/**
 * The invoice rows. In a row, Enter adds a row after it (unless it picks a
 * suggestion), ⌘D duplicates it and ⌘⇧⌫ deletes it; a new row takes the unit
 * and VAT rate of the one above. While the invoice type is İstisna every row's
 * VAT rate is 0; a rate it replaced comes back when the type changes again.
 */
export function InvoiceItems({ form }: { form: InvoiceForm }) {
  const { defaultItemAdvanced, newId } = useStore();
  const currency = useFormState(form.store, (state) => state.values.invoiceSettings.currency);
  const rowCount = useFormState(form.store, (state) => state.values.items.length);
  const istisna = useFormState(
    form.store,
    (state) => state.values.invoiceSettings.invoiceType === 'ISTISNA',
  );
  const vatToLock = useFormState(
    form.store,
    (state) =>
      state.values.invoiceSettings.invoiceType === 'ISTISNA' &&
      state.values.items.some((item) => item.VATRate !== 0),
  );
  // The fields that take the focus once a row was added or removed: the first
  // one that exists.
  const focusIds = useRef<Array<string> | null>(null);
  // The VAT rates the İstisna lock replaced, by row id.
  const lockedRates = useRef(new Map<string, number>());

  useEffect(() => {
    if (focusIds.current !== null) {
      for (const id of focusIds.current) {
        const element = document.getElementById(id);
        if (element) {
          element.focus();
          break;
        }
      }
      focusIds.current = null;
    }
  }, [rowCount]);

  useEffect(() => {
    if (!vatToLock) {
      return;
    }
    form.getFieldValue('items').forEach((item, index) => {
      if (item.VATRate !== 0) {
        if (Number.isFinite(item.VATRate)) {
          lockedRates.current.set(item.id, item.VATRate);
        }
        form.setFieldValue(at(index, 'VATRate'), 0);
      }
    });
  }, [form, vatToLock]);

  useEffect(() => {
    if (istisna || lockedRates.current.size === 0) {
      return;
    }
    form.getFieldValue('items').forEach((item, index) => {
      const rate = lockedRates.current.get(item.id);
      if (rate !== undefined && item.VATRate === 0) {
        form.setFieldValue(at(index, 'VATRate'), rate);
      }
    });
    lockedRates.current.clear();
  }, [form, istisna]);

  const mod = isMac ? '⌘' : 'Ctrl ';

  return (
    <form.Field mode="array" name="items">
      {(field) => {
        const rows = field.state.value;
        const insertAfter = (index: number) => {
          const above = rows[index];
          void field.insertValue(index + 1, {
            ...defaultItemAdvanced,
            id: newId(),
            name: '',
            quantity: 1,
            unitPrice: 0,
            unitType: above?.unitType ?? defaultItemAdvanced.unitType,
            VATRate: above?.VATRate ?? 20,
          });
          focusIds.current = [at(index + 1, 'name')];
        };
        // The copy takes the focus in the field the shortcut came from.
        const duplicate = (index: number, fromId: string) => {
          void field.insertValue(index + 1, { ...rows[index], id: newId() });
          const prefix = `items[${index}].`;
          focusIds.current = fromId.startsWith(prefix)
            ? [`items[${index + 1}].${fromId.slice(prefix.length)}`, at(index + 1, 'name')]
            : [at(index + 1, 'name')];
        };
        const remove = (index: number) => {
          void field.removeValue(index);
          focusIds.current = [at(Math.max(0, index - 1), 'name')];
        };
        const onKeyDown = (event: KeyboardEvent<HTMLLIElement>, index: number) => {
          if (event.nativeEvent.isComposing) {
            return;
          }
          const target = event.target as HTMLElement;
          const command = (isMac ? event.metaKey : event.ctrlKey) && !event.altKey;
          if (command && event.shiftKey && event.key === 'Backspace') {
            event.preventDefault();
            if (rows.length > 1) {
              remove(index);
            }
            return;
          }
          if (command && !event.shiftKey && event.key.toLowerCase() === 'd') {
            event.preventDefault();
            duplicate(index, target.id);
            return;
          }
          // A chip cancels its Enter only so it does not click; the row takes it.
          const chip = target.getAttribute('role') === 'radio';
          if (
            event.key !== 'Enter' ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey ||
            event.shiftKey ||
            !(chip || (target.tagName === 'INPUT' && !event.defaultPrevented))
          ) {
            return;
          }
          event.preventDefault();
          insertAfter(index);
        };

        return (
          <>
            <ol aria-label="Hizmetler" {...props(styles.list)}>
              {rows.map((item, index) => (
                <li
                  key={item.id}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  {...props(styles.row)}
                >
                  <ItemRow
                    canRemove={rows.length > 1}
                    currency={currency}
                    form={form}
                    index={index}
                    item={item}
                    onRemove={() => remove(index)}
                  />
                </li>
              ))}
            </ol>
            <div {...props(styles.addRow)}>
              <Button onClick={() => insertAfter(rows.length - 1)} variant="outline">
                <PlusIcon />
                Hizmet ekle
              </Button>
              <span {...props(styles.hint)}>
                <span {...props(styles.hintItem)}>
                  <Kbd>↵</Kbd>
                  yeni hizmet
                </span>
                <span {...props(styles.hintItem)}>
                  <Kbd>{mod}D</Kbd>
                  çoğalt
                </span>
                <span {...props(styles.hintItem)}>
                  <Kbd>{isMac ? '⌘⇧⌫' : 'Ctrl ⇧ ⌫'}</Kbd>
                  sil
                </span>
              </span>
            </div>
          </>
        );
      }}
    </form.Field>
  );
}
