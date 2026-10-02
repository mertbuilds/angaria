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
  spellCheck = false,
  ...frame
}: FieldProps & {
  autoComplete?: string;
  inputMode?: 'decimal' | 'numeric' | 'text';
  maxLength?: number;
  placeholder?: string;
  /** Off by default: names, numbers and codes are not words to check. */
  spellCheck?: boolean;
}) {
  const field = useFieldContext<string>();
  const error = useFieldError({ typed: true });
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
          spellCheck={spellCheck}
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
  const error = useFieldError({ typed: true });
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
