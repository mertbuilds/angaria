import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@angaria/ui';
import { colors, font } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useRef, useState } from 'react';
import { FieldFrame, useFieldContext, useFieldError, type FieldProps } from '../form-field.tsx';

const styles = create({
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

export interface FieldOption {
  label: string;
  value: string;
}

export function SelectField({
  items,
  ...frame
}: FieldProps & { items: ReadonlyArray<FieldOption> }) {
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
export function ComboboxField({
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
export function SuggestField({
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
