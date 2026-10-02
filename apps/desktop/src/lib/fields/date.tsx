import { Input } from '@angaria/ui';
import { create } from '@stylexjs/stylex';
import { useState } from 'react';
import { FieldFrame, useFieldContext, useFieldError, type FieldProps } from '../form-field.tsx';
import { gibToInputDate, inputDateToGIB } from '../invoice-form.ts';
import { toGIB } from '../utils.ts';

const styles = create({
  tabular: {
    fontVariantNumeric: 'tabular-nums',
  },
});

/**
 * A GİB date ("30/09/2026") in the system date picker. Empty means today when
 * `emptyIsToday`, otherwise no date. Days after today cannot be picked unless
 * `allowFuture` (a due date).
 */
export function DateField({
  allowFuture = false,
  emptyIsToday = false,
  ...frame
}: FieldProps & { allowFuture?: boolean; emptyIsToday?: boolean }) {
  const field = useFieldContext<string>();
  const error = useFieldError();
  const [today] = useState(() => gibToInputDate(toGIB(new Date())));
  const value = gibToInputDate(field.state.value) || (emptyIsToday ? today : '');
  return (
    <FieldFrame {...frame} error={error} id={field.name}>
      {(describedBy) => (
        <Input
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          id={field.name}
          max={allowFuture ? undefined : today}
          name={field.name}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(inputDateToGIB(event.target.value))}
          style={styles.tabular}
          type="date"
          value={value}
        />
      )}
    </FieldFrame>
  );
}

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
          step={1}
          style={styles.tabular}
          type="time"
          value={field.state.value}
        />
      )}
    </FieldFrame>
  );
}
