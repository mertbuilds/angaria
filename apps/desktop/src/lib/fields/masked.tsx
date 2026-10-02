import { MaskedInput } from '@angaria/ui';
import type { MaskitoOptions } from '@maskito/core';
import { FieldFrame, useFieldContext, useFieldError, type FieldProps } from '../form-field.tsx';

/**
 * A fixed-shape ID (IBAN, phone, GTİP) typed through a mask. Not in the form
 * registry yet, and no check icon or blur-only checksum errors yet.
 */
export function MaskedField({
  mask,
  placeholder,
  ...frame
}: FieldProps & { mask: MaskitoOptions; placeholder?: string }) {
  const field = useFieldContext<string>();
  const error = useFieldError();
  return (
    <FieldFrame {...frame} error={error} id={field.name}>
      {(describedBy) => (
        <MaskedInput
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          id={field.name}
          mask={mask}
          name={field.name}
          onBlur={field.handleBlur}
          onInput={(event) => field.handleChange(event.currentTarget.value)}
          placeholder={placeholder}
          value={field.state.value}
        />
      )}
    </FieldFrame>
  );
}
