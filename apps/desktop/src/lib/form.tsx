import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props, type StyleXStyles } from '@stylexjs/stylex';
import { createFormHook, createFormHookContexts } from '@tanstack/react-form';
import { useRef, useState, type ReactNode } from 'react';
import { formatDecimal, gibToInputDate, inputDateToGIB, parseDecimal } from './invoice-form.ts';
import { toGIB } from './utils.ts';

// The desktop app's form canon, after web-starter's apps/web/src/lib/form.tsx:
// TanStack Form with the checks in a form-level `validators.onChange` (it also
// runs on submit), never a form-level onBlur. Fields render through
// `form.AppField` and the bound components below, which show a field's error
// once it was touched; a submit touches every field.

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
  number: {
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
  },
  tabular: {
    fontVariantNumeric: 'tabular-nums',
  },
  suggestionHint: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: font.sizeXs,
    fontVariantNumeric: 'tabular-nums',
    marginInlineStart: 'auto',
  },
  suggestionLabel: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

/** The field's error once it was touched, else undefined. */
function useFieldError() {
  const field = useFieldContext<unknown>();
  if (!field.state.meta.isTouched) {
    return undefined;
  }
  const error = field.state.meta.errors.find((item) => typeof item === 'string');
  return typeof error === 'string' ? error : undefined;
}

interface FieldProps {
  /** Small muted label, for dense rows such as invoice items. */
  compact?: boolean;
  /** Shown under the control while it has no error. */
  description?: ReactNode;
  label: string;
  style?: StyleXStyles;
}

/** Label, control, then the error or the description, wired for screen readers. */
function FieldFrame({
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

function TextField({
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

function TextareaField({
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

/**
 * A number typed the Turkish way ("1.250,5"). Keeps the text as typed while it
 * stores the parsed value; text that does not parse stores NaN, which the
 * form's checks report. Tidies the text on blur.
 */
function NumberField({
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

  // A value set elsewhere (an item template filled the row) replaces the text.
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

/**
 * A GİB date ("30/09/2026") in the system date picker. Empty means today when
 * `emptyIsToday`, otherwise no date. Days after today cannot be picked.
 */
function DateField({ emptyIsToday = false, ...frame }: FieldProps & { emptyIsToday?: boolean }) {
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
          max={today}
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

function TimeField(frame: FieldProps) {
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

export interface FieldOption {
  label: string;
  value: string;
}

function SelectField({ items, ...frame }: FieldProps & { items: ReadonlyArray<FieldOption> }) {
  const field = useFieldContext<string>();
  return (
    <FieldFrame {...frame} id={field.name}>
      {() => (
        <Select
          items={items}
          onValueChange={(value) => value && field.handleChange(value)}
          value={field.state.value}
        >
          <SelectTrigger id={field.name}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FieldFrame>
  );
}

/** A choice from a long list (countries, currencies), filtered by typing. */
function ComboboxField({
  clearable = false,
  emptyText,
  items,
  placeholder,
  ...frame
}: FieldProps & {
  /** Allows going back to no choice. */
  clearable?: boolean;
  emptyText: string;
  items: ReadonlyArray<FieldOption>;
  placeholder?: string;
}) {
  const field = useFieldContext<string>();
  const error = useFieldError();
  const selected = items.find((item) => item.value === field.state.value) ?? null;
  return (
    <FieldFrame {...frame} error={error} id={field.name}>
      {(describedBy) => (
        <Combobox
          isItemEqualToValue={(item: FieldOption, value: FieldOption) => item.value === value.value}
          items={items}
          locale="tr"
          onValueChange={(item: FieldOption | null) => field.handleChange(item?.value ?? '')}
          value={selected}
        >
          <ComboboxInput
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            id={field.name}
            onBlur={field.handleBlur}
            onFocus={(event) => event.currentTarget.select()}
            placeholder={placeholder}
            showClear={clearable && selected !== null}
          />
          <ComboboxContent>
            <ComboboxEmpty>{emptyText}</ComboboxEmpty>
            <ComboboxList>
              {(item: FieldOption) => (
                <ComboboxItem key={item.value} value={item}>
                  {item.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}
    </FieldFrame>
  );
}

export interface Suggestion {
  /** Muted text at the end of the row, e.g. a price. */
  hint?: string;
  id: string;
  label: string;
}

/**
 * Free text with suggestions: typing keeps whatever is typed, picking a
 * suggestion calls `onPick` (which usually fills more fields).
 */
function SuggestField({
  onPick,
  placeholder,
  suggestions,
  ...frame
}: FieldProps & {
  onPick: (suggestion: Suggestion) => void;
  placeholder?: string;
  suggestions: ReadonlyArray<Suggestion>;
}) {
  const field = useFieldContext<string>();
  const error = useFieldError();
  const [open, setOpen] = useState(false);
  const highlighted = useRef(false);
  const text = field.state.value;
  const query = text.trim().toLocaleLowerCase('tr');
  const matches = suggestions.filter((suggestion) => {
    const label = suggestion.label.toLocaleLowerCase('tr');
    return label !== query && label.includes(query);
  });
  const visible = open && matches.length > 0;

  return (
    <FieldFrame {...frame} error={error} id={field.name}>
      {(describedBy) => (
        <Combobox
          filter={null}
          inputValue={text}
          items={matches}
          itemToStringLabel={(suggestion: Suggestion) => suggestion.label}
          onInputValueChange={(value, details) => {
            if (details.reason === 'input-change' || details.reason === 'item-press') {
              field.handleChange(value);
            }
          }}
          onItemHighlighted={(suggestion) => {
            highlighted.current = suggestion !== undefined;
          }}
          onOpenChange={setOpen}
          onValueChange={(suggestion: Suggestion | null) => suggestion && onPick(suggestion)}
          open={visible}
          value={null}
        >
          <ComboboxInput
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            id={field.name}
            onBlur={field.handleBlur}
            // An Enter that picks a suggestion is not the row's Enter.
            onKeyDown={(event) => {
              if (event.key === 'Enter' && visible && highlighted.current) {
                event.preventDefault();
              }
            }}
            placeholder={placeholder}
            showTrigger={false}
          />
          <ComboboxContent>
            <ComboboxList>
              {(suggestion: Suggestion) => (
                <ComboboxItem key={suggestion.id} value={suggestion}>
                  <span {...props(styles.suggestionLabel)}>{suggestion.label}</span>
                  {suggestion.hint && (
                    <span {...props(styles.suggestionHint)}>{suggestion.hint}</span>
                  )}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}
    </FieldFrame>
  );
}

export const { useAppForm } = createFormHook({
  fieldComponents: {
    ComboboxField,
    DateField,
    NumberField,
    SelectField,
    SuggestField,
    TextareaField,
    TextField,
    TimeField,
  },
  fieldContext,
  formComponents: {},
  formContext,
});
