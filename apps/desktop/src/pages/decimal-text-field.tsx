import { NumberInput } from '@angaria/ui';
import { useRef, type ReactNode } from 'react';
import { FieldFrame, useFieldContext, useFieldError, type FieldProps } from '@/lib/form-field.tsx';
import { formatDecimal, parseDecimal } from '@/lib/invoice-form.ts';

/** A number as text that parseDecimal reads back as exactly the same number. */
function toText(value: number) {
  const text = String(value);
  return text.includes('e') ? formatDecimal(value, 20) : text.replace('.', ',');
}

/**
 * The number the stored text means. toText keeps a negative result as "-5",
 * which parseDecimal refuses; the field shows it while the form's check
 * reports it.
 */
function textValue(text: string) {
  const digits = /^\s*-(.*\d.*)$/.exec(text)?.[1];
  const negative = digits === undefined ? null : parseDecimal(digits);
  return parseDecimal(text) ?? (negative === null ? Number.NaN : -negative);
}

/**
 * NumberField for a number the invoice form keeps as text (the currency rate,
 * Ödenecek tutar): the text stays as typed and an expression ("3*1.500") stores
 * its result. Text that does not parse is stored as typed, so the form's check
 * reports it; an empty field stores ''.
 */
export function DecimalTextField({
  format,
  placeholder,
  step,
  suffix,
  ...frame
}: FieldProps & {
  /** The text a value shows once the field is left. */
  format: (value: number) => string;
  placeholder?: string;
  step?: number;
  /** Inside the field's end, e.g. ₺. */
  suffix?: ReactNode;
}) {
  const field = useFieldContext<string>();
  const error = useFieldError({ typed: true });
  const inputRef = useRef<HTMLInputElement>(null);
  const text = field.state.value;
  const value = text.trim() ? textValue(text) : Number.NaN;
  return (
    <FieldFrame {...frame} error={error} id={field.name}>
      {(describedBy) => (
        <NumberInput
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          format={format}
          id={field.name}
          name={field.name}
          onBlur={field.handleBlur}
          onValueChange={(next) => {
            const typed = inputRef.current?.value ?? '';
            if (Number.isNaN(next)) {
              field.handleChange(typed);
            } else {
              field.handleChange(typed.trim() || next !== 0 ? toText(next) : '');
            }
          }}
          parse={parseDecimal}
          placeholder={placeholder}
          ref={inputRef}
          step={step}
          suffix={suffix}
          value={value}
        />
      )}
    </FieldFrame>
  );
}
