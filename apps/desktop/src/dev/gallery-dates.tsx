// The date components in the dev gallery (ui-gallery.tsx).
import {
  Calendar,
  DateField,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  type DatePreset,
} from '@angaria/ui';
import { spacing } from '@angaria/ui/tokens.stylex';
import { getLocalTimeZone, today, type CalendarDate } from '@internationalized/date';
import { create, props } from '@stylexjs/stylex';
import { useId, useState } from 'react';
import { DATE_TEXT_HINT, parseTurkishDate } from '@/lib/tr-date.ts';

const styles = create({
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    maxWidth: '22rem',
  },
});

const PAST_PRESETS: ReadonlyArray<DatePreset> = [
  { date: (now) => now, label: 'Bugün' },
  { date: (now) => now.subtract({ days: 1 }), label: 'Dün' },
  { date: (now) => now.set({ day: 1 }).subtract({ days: 1 }), label: 'Geçen ayın son günü' },
];

const DUE_PRESETS: ReadonlyArray<DatePreset> = [0, 7, 14, 30].map((days) => ({
  date: (now) => now.add({ days }),
  label: days === 0 ? 'Peşin' : `${days} gün`,
}));

export function GalleryDates() {
  const id = useId();
  const [now] = useState(() => today(getLocalTimeZone()));
  const [date, setDate] = useState<CalendarDate | null>(now);
  const [due, setDue] = useState<CalendarDate | null>(null);
  const [broken, setBroken] = useState<CalendarDate | null>(() => now.add({ days: 3 }));
  return (
    <div {...props(styles.stack)}>
      <Field>
        <FieldLabel htmlFor={`${id}-date`} id={`${id}-date-label`}>
          Tarih
        </FieldLabel>
        <DateField
          aria-describedby={`${id}-date-description`}
          aria-labelledby={`${id}-date-label`}
          id={`${id}-date`}
          maxValue={now}
          onChange={setDate}
          parseText={(text, day) => parseTurkishDate(text, day, 'past')}
          presets={PAST_PRESETS}
          textHint={DATE_TEXT_HINT}
          value={date}
        />
        <FieldDescription id={`${id}-date-description`}>
          Harf yazınca ya da Alt+↓ ile takvim açılır.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-due`} id={`${id}-due-label`}>
          Son ödeme tarihi
        </FieldLabel>
        <DateField
          aria-labelledby={`${id}-due-label`}
          id={`${id}-due`}
          minValue={now}
          onChange={setDue}
          parseText={(text, day) => parseTurkishDate(text, day, 'future')}
          presets={DUE_PRESETS}
          textHint={DATE_TEXT_HINT}
          value={due}
        />
      </Field>
      <Field data-invalid>
        <FieldLabel htmlFor={`${id}-broken`} id={`${id}-broken-label`}>
          Hatalı
        </FieldLabel>
        <DateField
          aria-describedby={`${id}-broken-error`}
          aria-labelledby={`${id}-broken-label`}
          id={`${id}-broken`}
          invalid
          onChange={setBroken}
          value={broken}
        />
        <FieldError id={`${id}-broken-error`}>Fatura tarihi bugünden sonra olamaz</FieldError>
      </Field>
      <Calendar maxValue={now} onChange={setDate} value={date} />
    </div>
  );
}
