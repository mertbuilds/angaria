import { colors, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { tones } from '../shell/palette.stylex.ts';
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

export function AdvancedSection({ form, total }: { form: InvoiceForm; total: string }) {
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
          <h2 {...props(sectionStyles.sectionTitle)}>Gelişmiş</h2>
          <span {...props(sectionStyles.sectionHint)}>İrsaliye, ödenecek tutar</span>
        </summary>
        <div {...props(sectionStyles.fields, styles.advancedFields)}>
          <form.AppField name="advancedFields.irsaliyeNumarasi">
            {(field) => <field.TextField label="İrsaliye numarası" />}
          </form.AppField>
          <form.AppField name="advancedFields.irsaliyeTarihi">
            {(field) => <field.DateField label="İrsaliye tarihi" />}
          </form.AppField>
          <form.AppField name="advancedFields.paymentTotal">
            {(field) => (
              <field.TextField
                description="Boş bırakırsan genel toplam kullanılır"
                inputMode="decimal"
                label="Ödenecek tutar"
                placeholder={total}
              />
            )}
          </form.AppField>
        </div>
      </details>
    </section>
  );
}
