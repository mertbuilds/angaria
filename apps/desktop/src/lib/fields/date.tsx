import { DateField as DateInput, Input, type DatePreset } from '@angaria/ui';
import { getLocalTimeZone, today as todayIn } from '@internationalized/date';
import { create } from '@stylexjs/stylex';
import { useMemo, useState } from 'react';
import { FieldFrame, useFieldContext, useFieldError, type FieldProps } from '../form-field.tsx';
import {
  calendarDateToGIB,
  DATE_TEXT_HINT,
  gibToCalendarDate,
  parseTurkishDate,
  type DateBias,
} from '../tr-date.ts';

const styles = create({
  tabular: {
    fontVariantNumeric: 'tabular-nums',
  },
});

/**
 * A GİB date ("30/09/2026") in Turkish segments with a calendar popover that
 * also reads typed text ("dün", "15.10"). Empty means today when
 * `emptyIsToday`, otherwise no date. Days after today cannot be picked unless
 * `allowFuture` (a due date). `bias` decides which way an incomplete typed
 * date leans; it follows `allowFuture` unless given.
 */
export function DateField({
  allowFuture = false,
  bias,
  emptyIsToday = false,
  presets,
  ...frame
}: FieldProps & {
  allowFuture?: boolean;
  bias?: DateBias;
  emptyIsToday?: boolean;
  presets?: ReadonlyArray<DatePreset>;
}) {
  const field = useFieldContext<string>();
  const error = useFieldError();
  const [today] = useState(() => todayIn(getLocalTimeZone()));
  const value = useMemo(
    () => gibToCalendarDate(field.state.value) ?? (emptyIsToday ? today : null),
    [emptyIsToday, field.state.value, today],
  );
  const textBias = bias ?? (allowFuture ? 'future' : 'past');
  return (
    <FieldFrame {...frame} error={error} id={field.name}>
      {(describedBy) => (
        <DateInput
          aria-describedby={describedBy}
          aria-label={frame.label}
          id={field.name}
          invalid={Boolean(error)}
          maxValue={allowFuture ? undefined : today}
          onBlur={field.handleBlur}
          onChange={(date) => field.handleChange(date ? calendarDateToGIB(date) : '')}
          parseText={(text, now) => parseTurkishDate(text, now, textBias)}
          presets={presets}
          textHint={DATE_TEXT_HINT}
          value={value}
        />
      )}
    </FieldFrame>
  );
}

/** HH:mm; normalizeTime adds the seconds GİB wants. */
export function TimeField(frame: FieldProps) {
  const field = useFieldContext<string>();
  const error = useFieldError();
  return (
    <FieldFrame {...frame} error={error} id={field.name}>
      {(describedBy) => (
        <Input
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          id={field.name}
          name={field.name}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
          step={60}
          style={styles.tabular}
          type="time"
          value={field.state.value.slice(0, 5)}
        />
      )}
    </FieldFrame>
  );
}
