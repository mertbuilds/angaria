import { Field, FieldDescription, FieldError, FieldLabel } from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, type StyleXStyles } from '@stylexjs/stylex';
import { createFormHookContexts } from '@tanstack/react-form';
import type { ReactNode } from 'react';

// What every bound field shares: the form contexts, the touched-error rule and
// the label/description/error frame. The bound fields live in lib/fields/, the
// registry in lib/form.tsx.

export const { fieldContext, formContext, useFieldContext } = createFormHookContexts();

const styles = create({
  compactField: {
    gap: spacing.s1,
  },
  compactLabel: {
    color: colors.muted,
    fontSize: font.sizeXs,
    fontWeight: font.weightRegular,
  },
});

/** The field's error once it was touched, else undefined. */
export function useFieldError() {
  const field = useFieldContext<unknown>();
  if (!field.state.meta.isTouched) {
    return undefined;
  }
  const error = field.state.meta.errors.find((item) => typeof item === 'string');
  return typeof error === 'string' ? error : undefined;
}

export interface FieldProps {
  /** Small muted label, for dense rows such as invoice items. */
  compact?: boolean;
  /** Shown under the control while it has no error. */
  description?: ReactNode;
  label: string;
  style?: StyleXStyles;
}

/** Label, control, then the error or the description, wired for screen readers. */
export function FieldFrame({
  children,
  compact,
  description,
  error,
  id,
  label,
  style,
}: FieldProps & {
  children: (describedBy: string | undefined) => ReactNode;
  error?: string;
  id: string;
}) {
  const describedBy = error ? `${id}-error` : description ? `${id}-description` : undefined;
  return (
    <Field data-invalid={error ? true : undefined} style={[compact && styles.compactField, style]}>
      <FieldLabel htmlFor={id} style={compact ? styles.compactLabel : undefined}>
        {label}
      </FieldLabel>
      {children(describedBy)}
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : (
        description && <FieldDescription id={`${id}-description`}>{description}</FieldDescription>
      )}
    </Field>
  );
}
