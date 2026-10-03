import { capStyles } from '@angaria/ui';
import { colors, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { formatAmount } from '@/lib/invoice-form.ts';
import { tones } from '../shell/palette.stylex.ts';
import { DecimalTextField } from './decimal-text-field.tsx';
import { sectionStyles } from './invoice-section.tsx';
import type { InvoiceForm } from './use-invoice-form.ts';

const styles = create({
  advancedFields: {
    paddingTop: spacing.s4,
  },
  summary: {
    '::-webkit-details-marker': {
      display: 'none',
    },
    alignItems: 'center',
    borderRadius: radius.base,
    cursor: 'pointer',
    display: 'flex',
    gap: spacing.s2,
    listStyle: 'none',
    outline: {
      ':focus-visible': `1px solid ${tones.ring}`,
      default: 'none',
    },
    outlineOffset: '4px',
    userSelect: 'none',
  },
  summaryIcon: {
    color: colors.muted,
    height: '1rem',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '150ms',
    },
    transitionProperty: 'transform',
    width: '1rem',
  },
  summaryIconOpen: {
    transform: 'rotate(90deg)',
  },
});

/** "₺", "$", "CHF": the currency as the money it suffixes. */
function currencySymbol(currency: string) {
  try {
    return (
      new Intl.NumberFormat('tr-TR', { currency, style: 'currency' })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? currency
    );
  } catch {
    return currency;
  }
}

/** Gelişmiş: the time, Ödenecek tutar and the irsaliye; starts open when either of the last two has a value. */
export function AdvancedSection({
  currency,
  form,
  total,
}: {
  currency: string;
  form: InvoiceForm;
  /** The invoice total, the amount due while Ödenecek tutar is empty. */
  total: number;
}) {
  const advanced = form.state.values.advancedFields;
  const [open, setOpen] = useState(() =>
    Boolean(advanced.irsaliyeNumarasi || advanced.irsaliyeTarihi || advanced.paymentTotal),
  );

  return (
    <section {...props(sectionStyles.section)}>
      <details onToggle={(event) => setOpen(event.currentTarget.open)} open={open}>
        <summary {...props(styles.summary)}>
          <ChevronRightIcon
            aria-hidden
            {...props(styles.summaryIcon, open && styles.summaryIconOpen)}
          />
          <h2 {...props(sectionStyles.sectionTitle, capStyles.text)}>Gelişmiş</h2>
          <span {...props(sectionStyles.sectionHint, capStyles.text)}>
            Saat, ödenecek tutar, irsaliye
          </span>
        </summary>
        <div {...props(sectionStyles.fields, styles.advancedFields)}>
          <form.AppField name="advancedFields.manualTime">
            {(field) => (
              <field.TimeField
                description="Boş bırakırsan GİB’e gönderdiğin an yazılır"
                label="Saat"
              />
            )}
          </form.AppField>
          <form.AppField name="advancedFields.paymentTotal">
            {() => (
              <DecimalTextField
                description="Boş bırakırsan genel toplam kullanılır"
                format={formatAmount}
                label="Ödenecek tutar"
                placeholder={formatAmount(total)}
                suffix={currencySymbol(currency)}
              />
            )}
          </form.AppField>
          <form.AppField name="advancedFields.irsaliyeNumarasi">
            {(field) => <field.TextField label="İrsaliye numarası" />}
          </form.AppField>
          <form.AppField name="advancedFields.irsaliyeTarihi">
            {(field) => <field.DateField label="İrsaliye tarihi" />}
          </form.AppField>
        </div>
      </details>
    </section>
  );
}
