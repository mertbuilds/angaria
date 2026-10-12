import { NumberInput } from '@angaria/ui';
import type { ReactNode } from 'react';
import { FieldFrame, useFieldContext, useFieldError, type FieldProps } from '../form-field.tsx';
import { formatDecimal, parseDecimal } from '../invoice-form.ts';

/**
 * A number typed the Turkish way ("1.250,5") or as arithmetic ("3*1.500"),
 * through NumberInput: the text stays as typed while the parsed value is
 * stored; text that does not parse stores NaN, which the form's checks
 * report. Tidies the text on blur and Enter, rounding the value to what the
 * text shows; ↑/↓ step.
 */
export function NumberField({
  allowExpressions,
  blankZero = false,
  format,
  fractionDigits = 4,
  largeStep,
  max,
  min,
  placeholder,
  step,
  steppers,
  suffix,
  ...frame
}: FieldProps & {
  /** `3*8`, `1200+15%` and the like. Default true. */
  allowExpressions?: boolean;
  /** Shows 0 as an empty field with the placeholder. */
  blankZero?: boolean;
  /** The text a value shows once the field is left. Default formatDecimal with `fractionDigits`. */
  format?: (value: number) => string;
  fractionDigits?: number;
  largeStep?: number;
  max?: number;
  min?: number;
  placeholder?: string;
  step?: number;
  /** Small − and + buttons inside the field. */
  steppers?: boolean;
  /** Inside the field's end, e.g. ₺ or %. */
  suffix?: ReactNode;
}) {
  const field = useFieldContext<number>();
  const error = useFieldError({ typed: true });
  const show = format ?? ((value: number) => formatDecimal(value, fractionDigits));
  // The form keeps the number the field shows: 0,33333 left as 0,3333 stores 0,3333.
  const roundToShown = () => {
    const value = field.state.value;
    const shown = Number.isFinite(value) ? parseDecimal(show(value)) : null;
    if (shown !== null && shown !== value) {
      field.handleChange(shown);
    }
  };
  return (
    <FieldFrame {...frame} error={error} id={field.name}>
      {(describedBy) => (
        <NumberInput
          allowExpressions={allowExpressions}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          blankZero={blankZero}
          format={show}
          id={field.name}
          largeStep={largeStep}
          max={max}
          min={min}
          name={field.name}
          onBlur={() => {
            roundToShown();
            field.handleBlur();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              roundToShown();
            }
          }}
          onValueChange={field.handleChange}
          parse={parseDecimal}
          placeholder={placeholder}
          step={step}
          steppers={steppers}
          suffix={suffix}
          value={field.state.value}
        />
      )}
    </FieldFrame>
  );
}
