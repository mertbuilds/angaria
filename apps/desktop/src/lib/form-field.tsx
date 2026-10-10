import { Field, FieldDescription, FieldError, FieldLabel, FieldWarning } from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, type StyleXStyles } from '@stylexjs/stylex';
import { createFormHookContexts, useStore } from '@tanstack/react-form';
import type { ReactNode } from 'react';
import { MessageText } from './rule-text.tsx';

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

/**
 * The field's error, or undefined while it is not shown. A choice (chips, a
 * list, a date) shows it once changed. Typed text (`typed`) shows it once it
 * was changed and left, or the form submitted: a half-typed value is not wrong
 * yet. From then on the error follows every keystroke, so a fix clears it.
 */
export function useFieldError({ typed = false }: { typed?: boolean } = {}) {
  const field = useFieldContext<unknown>();
  const submitted = useStore(field.form.store, (state) => state.submissionAttempts > 0);
  const { errors, isBlurred, isDirty, isTouched } = field.state.meta;
  // A submit touches the fields there are; a row added after it waits for its own edit.
  const shown = typed ? (isDirty && isBlurred) || (isTouched && submitted) : isTouched;
  if (!shown) {
    return undefined;
  }
  const error = errors.find((item) => typeof item === 'string');
  return typeof error === 'string' ? error : undefined;
}

export interface FieldProps {
  /** Small muted label, for dense rows such as invoice items. */
  compact?: boolean;
  /** Shown under the control while it has no error. */
  description?: ReactNode;
  label: string;
  style?: StyleXStyles;
  /** A rule the value breaks that does not block submit, shown while it has no error. */
  warning?: ReactNode;
}

/**
 * Label, control, then the error, or the description and the warning, wired
 * for screen readers. The label's id is `{id}-label`, for controls that are
 * named by aria-labelledby (a chip group) instead of <label htmlFor>.
 */
export function FieldFrame({
  children,
  compact,
  description,
  error,
  id,
  label,
  style,
  warning,
}: FieldProps & {
  children: (describedBy: string | undefined) => ReactNode;
  error?: string;
  id: string;
}) {
  const describedBy = error
    ? `${id}-error`
    : [description && `${id}-description`, warning && `${id}-warning`].filter(Boolean).join(' ') ||
      undefined;
  return (
    <Field data-invalid={error ? true : undefined} style={[compact && styles.compactField, style]}>
      <FieldLabel htmlFor={id} id={`${id}-label`} style={compact ? styles.compactLabel : undefined}>
        {label}
      </FieldLabel>
      {children(describedBy)}
      {error ? (
        <FieldError id={`${id}-error`}>
          <MessageText>{error}</MessageText>
        </FieldError>
      ) : (
        <>
          {description && (
            <FieldDescription id={`${id}-description`}>{description}</FieldDescription>
          )}
          {warning && (
            <FieldWarning id={`${id}-warning`}>
              <MessageText>{warning}</MessageText>
            </FieldWarning>
          )}
        </>
      )}
    </Field>
  );
}
