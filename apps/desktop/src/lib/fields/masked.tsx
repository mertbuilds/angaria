import { MaskedInput } from '@angaria/ui';
import { colors } from '@angaria/ui/tokens.stylex';
import type { MaskitoOptions } from '@maskito/core';
import { create, props } from '@stylexjs/stylex';
import { CheckIcon } from 'lucide-react';
import { FieldFrame, useFieldContext, useFieldError, type FieldProps } from '../form-field.tsx';

const styles = create({
  check: {
    color: colors.muted,
    height: '1rem',
    insetInlineEnd: '1rem',
    pointerEvents: 'none',
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '1rem',
  },
  checked: {
    paddingInlineEnd: '2.5rem',
  },
  tabular: {
    fontVariantNumeric: 'tabular-nums',
  },
  wrap: {
    position: 'relative',
  },
});

/**
 * A fixed-shape ID (IBAN, phone, GTİP) typed through a mask. Its error shows
 * on blur, not while typing; a value `isValid` accepts gets a quiet check.
 */
export function MaskedField({
  autoComplete = 'off',
  inputMode,
  isValid,
  mask,
  placeholder,
  ...frame
}: FieldProps & {
  autoComplete?: string;
  inputMode?: 'numeric' | 'tel' | 'text';
  /** Whether the value is complete and passes its check, e.g. isValidTRIBAN. */
  isValid?: (value: string) => boolean;
  mask: MaskitoOptions;
  placeholder?: string;
}) {
  const field = useFieldContext<string>();
  const error = useFieldError({ typed: true });
  const valid = !error && isValid !== undefined && isValid(field.state.value);
  return (
    <FieldFrame {...frame} error={error} id={field.name}>
      {(describedBy) => (
        <div {...props(styles.wrap)}>
          <MaskedInput
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            autoComplete={autoComplete}
            id={field.name}
            inputMode={inputMode}
            mask={mask}
            name={field.name}
            onBlur={field.handleBlur}
            onInput={(event) => field.handleChange(event.currentTarget.value)}
            placeholder={placeholder}
            style={[styles.tabular, valid && styles.checked]}
            value={field.state.value}
          />
          {valid && <CheckIcon aria-hidden {...props(styles.check)} />}
        </div>
      )}
    </FieldFrame>
  );
}
