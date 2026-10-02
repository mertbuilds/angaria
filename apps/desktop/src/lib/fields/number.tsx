import { Input } from '@angaria/ui';
import { create } from '@stylexjs/stylex';
import { useState } from 'react';
import { FieldFrame, useFieldContext, useFieldError, type FieldProps } from '../form-field.tsx';
import { formatDecimal, parseDecimal } from '../invoice-form.ts';

const styles = create({
  number: {
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
  },
});

/**
 * A number typed the Turkish way ("1.250,5"). Keeps the text as typed while it
 * stores the parsed value; text that does not parse stores NaN, which the
 * form's checks report. Tidies the text on blur.
 */
export function NumberField({
  blankZero = false,
  fractionDigits = 4,
  placeholder,
  ...frame
}: FieldProps & {
  /** Shows 0 as an empty field with the placeholder. */
  blankZero?: boolean;
  fractionDigits?: number;
  placeholder?: string;
}) {
  const field = useFieldContext<number>();
  const error = useFieldError();
  const value = field.state.value;
  const show = (number: number) =>
    Number.isNaN(number) || (blankZero && number === 0)
      ? ''
      : formatDecimal(number, fractionDigits);
  const [text, setText] = useState(() => show(value));
  const [shown, setShown] = useState(value);

  // A value set elsewhere (a saved service filled the row) replaces the text.
  if (!Object.is(shown, value)) {
    setShown(value);
    if (!Object.is(parseDecimal(text) ?? Number.NaN, value)) {
      setText(show(value));
    }
  }

  return (
    <FieldFrame {...frame} error={error} id={field.name}>
      {(describedBy) => (
        <Input
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          id={field.name}
          inputMode="decimal"
          name={field.name}
          onBlur={() => {
            field.handleBlur();
            if (!Number.isNaN(value)) {
              setText(show(value));
            }
          }}
          onChange={(event) => {
            setText(event.target.value);
            const next = parseDecimal(event.target.value) ?? Number.NaN;
            setShown(next);
            field.handleChange(next);
          }}
          placeholder={placeholder}
          style={styles.number}
          value={text}
        />
      )}
    </FieldFrame>
  );
}
