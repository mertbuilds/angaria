import { Button } from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useStore as useFormState } from '@tanstack/react-form';
import { ChevronRightIcon, PlusIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { GIB_UNIT_TYPES } from '@/lib/gib-constants.ts';
import { discountForRate, lineTotals } from '@/lib/invoice-form.ts';
import { useStore } from '@/lib/store.tsx';
import type { InvoiceItem } from '@/lib/types.ts';
import { formatMoney } from '@/shell/searchable-list.tsx';
import type { InvoiceForm } from './use-invoice-form.ts';

const styles = create({
  addRow: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s3,
    justifyContent: 'space-between',
    paddingTop: spacing.s3,
  },
  amount: {
    alignItems: 'flex-end',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
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
    gap: spacing.s3,
    minWidth: 0,
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  discountFields: {
    display: 'grid',
    gap: spacing.s2,
    gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 1fr)',
  },
  hint: {
    color: colors.muted,
    fontSize: font.sizeXs,
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
  index: {
    color: colors.muted,
    fontSize: font.sizeXs,
    fontVariantNumeric: 'tabular-nums',
    width: '1.25rem',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  numbers: {
    display: 'grid',
    gap: spacing.s2,
    gridTemplateColumns:
      'minmax(0, 0.8fr) minmax(0, 1.1fr) minmax(0, 1.2fr) minmax(0, 0.7fr) minmax(6.5rem, 1fr)',
  },
  row: {
    borderTopColor: colors.border,
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
      ':focus-visible': `1px solid ${colors.muted}`,
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
});

const UNIT_OPTIONS = GIB_UNIT_TYPES;

const hasDiscount = (item: InvoiceItem) =>
  Boolean(item.discountRate || item.discountAmount || item.discountReason || item.gtip);

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
  const [discountOpen, setDiscountOpen] = useState(() => hasDiscount(item));
  const line = lineTotals(item);
  const at = <K extends keyof InvoiceItem>(key: K) => `items[${index}].${key}` as const;

  const suggestions = useMemo(
    () =>
      savedItems
        .filter((saved) => saved.name.trim())
        .map((saved) => ({
          hint: formatMoney(saved.unitPrice),
          id: saved.id,
          label: saved.name,
        })),
    [savedItems],
  );

  // The amount follows the rate while one is set; typing an amount drops it.
  const recomputeDiscount = () => {
    const current = form.getFieldValue(`items[${index}]`);
    if (current.discountRate > 0) {
      form.setFieldValue(at('discountAmount'), discountForRate(current, current.discountRate), {
        dontRunListeners: true,
      });
    }
  };

  return (
    <>
      <span {...props(styles.gutter, styles.index)}>{index + 1}</span>
      <div {...props(styles.body)}>
        <form.AppField name={at('name')}>
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
        <div {...props(styles.numbers)}>
          <form.AppField listeners={{ onChange: recomputeDiscount }} name={at('quantity')}>
            {(field) => <field.NumberField compact label="Miktar" />}
          </form.AppField>
          <form.AppField name={at('unitType')}>
            {(field) => <field.SelectField compact items={UNIT_OPTIONS} label="Birim" />}
          </form.AppField>
          <form.AppField listeners={{ onChange: recomputeDiscount }} name={at('unitPrice')}>
            {(field) => (
              <field.NumberField blankZero compact label="Birim fiyat" placeholder="0,00" />
            )}
          </form.AppField>
          <form.AppField name={at('VATRate')}>
            {(field) => <field.NumberField compact label="KDV %" />}
          </form.AppField>
          <div {...props(styles.amount)}>
            <span {...props(styles.amountLabel)}>Tutar</span>
            <span {...props(styles.amountValue)}>{formatMoney(line.net, currency)}</span>
            <span {...props(styles.amountVAT)}>+ {formatMoney(line.vat, currency)} KDV</span>
          </div>
        </div>
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
            İskonto ve GTİP
          </summary>
          <div {...props(styles.discountFields)}>
            <form.AppField
              listeners={{
                onChange: ({ value }) => {
                  if (Number.isFinite(value)) {
                    const current = form.getFieldValue(`items[${index}]`);
                    form.setFieldValue(at('discountAmount'), discountForRate(current, value), {
                      dontRunListeners: true,
                    });
                  }
                },
              }}
              name={at('discountRate')}
            >
              {(field) => <field.NumberField blankZero compact label="İskonto %" placeholder="0" />}
            </form.AppField>
            <form.AppField
              listeners={{
                onChange: () =>
                  form.setFieldValue(at('discountRate'), 0, { dontRunListeners: true }),
              }}
              name={at('discountAmount')}
            >
              {(field) => (
                <field.NumberField blankZero compact label="İskonto tutarı" placeholder="0,00" />
              )}
            </form.AppField>
            <form.AppField name={at('discountReason')}>
              {(field) => <field.TextField compact label="İskonto nedeni" />}
            </form.AppField>
            <form.AppField name={at('gtip')}>
              {(field) => <field.TextField compact inputMode="numeric" label="GTİP" />}
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
 * The invoice rows. Enter in a row's field adds a row after it (unless it
 * picks a suggestion); a new row takes the unit and VAT rate of the one above.
 */
export function InvoiceItems({ form }: { form: InvoiceForm }) {
  const { defaultItemAdvanced, newId } = useStore();
  const currency = useFormState(form.store, (state) => state.values.invoiceSettings.currency);
  const rowCount = useFormState(form.store, (state) => state.values.items.length);
  // The row whose name field takes the focus once a row was added or removed.
  const focusIndex = useRef<number | null>(null);

  useEffect(() => {
    if (focusIndex.current !== null) {
      document.getElementById(`items[${focusIndex.current}].name`)?.focus();
      focusIndex.current = null;
    }
  }, [rowCount]);

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
          focusIndex.current = index + 1;
        };
        const onKeyDown = (event: KeyboardEvent<HTMLLIElement>, index: number) => {
          if (
            event.key !== 'Enter' ||
            event.defaultPrevented ||
            event.nativeEvent.isComposing ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey ||
            event.shiftKey ||
            (event.target as HTMLElement).tagName !== 'INPUT'
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
                    onRemove={() => {
                      void field.removeValue(index);
                      focusIndex.current = Math.max(0, index - 1);
                    }}
                  />
                </li>
              ))}
            </ol>
            <div {...props(styles.addRow)}>
              <Button onClick={() => insertAfter(rows.length - 1)} variant="outline">
                <PlusIcon />
                Hizmet ekle
              </Button>
              <span {...props(styles.hint)}>Satırda ↵ yeni hizmet ekler</span>
            </div>
          </>
        );
      }}
    </form.Field>
  );
}
