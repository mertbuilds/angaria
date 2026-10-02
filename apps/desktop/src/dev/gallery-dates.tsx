// The date components in the dev gallery (ui-gallery.tsx).
import { Calendar, DateField } from '@angaria/ui';
import { spacing } from '@angaria/ui/tokens.stylex';
import { getLocalTimeZone, today, type CalendarDate } from '@internationalized/date';
import { create, props } from '@stylexjs/stylex';
import { useId, useState } from 'react';

const styles = create({
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    maxWidth: '22rem',
  },
});

export function GalleryDates() {
  const id = useId();
  const [date, setDate] = useState<CalendarDate | null>(() => today(getLocalTimeZone()));
  return (
    <div {...props(styles.stack)}>
      <DateField id={id} onChange={setDate} value={date} />
      <Calendar onChange={setDate} value={date} />
    </div>
  );
}
