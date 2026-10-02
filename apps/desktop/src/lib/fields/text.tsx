import { Input, Textarea } from '@angaria/ui';
import { create } from '@stylexjs/stylex';
import { FieldFrame, useFieldContext, useFieldError, type FieldProps } from '../form-field.tsx';

const styles = create({
  number: {
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
  },
});

export function TextField({
  autoComplete = 'off',
  inputMode,
  maxLength,
  placeholder,
  ...frame
}: FieldProps & {
  autoComplete?: string;
  inputMode?: 'decimal' | 'numeric' | 'text';
  maxLength?: number;
  placeholder?: string;
}) {
  const field = useFieldContext<string>();
  const error = useFieldError();
  return (
    <FieldFrame {...frame} error={error} id={field.name}>
      {(describedBy) => (
        <Input
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          autoComplete={autoComplete}
          id={field.name}
          inputMode={inputMode}
          maxLength={maxLength}
          name={field.name}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
          placeholder={placeholder}
          style={inputMode === 'decimal' ? styles.number : undefined}
          value={field.state.value}
        />
      )}
    </FieldFrame>
  );
}

export function TextareaField({
  placeholder,
  rows = 3,
  ...frame
}: FieldProps & { placeholder?: string; rows?: number }) {
  const field = useFieldContext<string>();
  const error = useFieldError();
  return (
    <FieldFrame {...frame} error={error} id={field.name}>
      {(describedBy) => (
        <Textarea
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          id={field.name}
          name={field.name}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          value={field.state.value}
        />
      )}
    </FieldFrame>
  );
}
