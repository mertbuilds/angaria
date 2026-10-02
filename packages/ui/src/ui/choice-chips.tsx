'use client';

import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { create, props as stylexProps } from '@stylexjs/stylex';
import { useId, useState, type ReactNode } from 'react';
import { colors, optional, radius } from '../lib/tokens.stylex.ts';

const styles = create({
  chip: {
    alignItems: 'center',
    borderRadius: radius.full,
    boxShadow: {
      ':focus-visible': `0 0 0 1px ${colors.ring}`,
      default: null,
    },
    boxSizing: 'border-box',
    color: colors.mutedForeground,
    cursor: 'pointer',
    display: 'inline-flex',
    flex: 1,
    fontSize: '0.8rem',
    height: '1.75rem',
    justifyContent: 'center',
    outline: 'none',
    paddingInline: '0.75rem',
    whiteSpace: 'nowrap',
  },
  chipChecked: {
    backgroundColor: optional.tabActive,
    boxShadow: {
      ':focus-visible': `0 0 0 1px ${colors.ring}`,
      default: `inset 0 0 0 1px ${optional.tabActiveEdge}`,
    },
    color: optional.tabActiveForeground,
  },
  chipDisabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  chipSmall: {
    fontSize: '0.75rem',
    height: '1.5rem',
    paddingInline: '0.5rem',
  },
  group: {
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    display: 'inline-flex',
    padding: '2px',
  },
});

export interface ChoiceOption<T extends string | number> {
  description?: string | undefined;
  disabled?: boolean | undefined;
  label: string;
  value: T;
}

export interface ChoiceChipsProps<T extends string | number> {
  'aria-labelledby'?: string | undefined;
  onValueChange: (value: T | null) => void;
  options: ReadonlyArray<ChoiceOption<T>>;
  /** A last chip ("Diğer") that reveals an input for a value outside `options`. */
  other?:
    | {
        label: string;
        render: (props: { autoFocus: boolean; id: string }) => ReactNode;
      }
    | undefined;
  size?: 'sm' | 'md' | undefined;
  /** A value outside `options` selects `other` and shows its input. */
  value: T | null;
}

const OTHER = 'other';

/**
 * One choice from a few options, as a row of chips with radio semantics.
 * Not implemented yet: digit keys, the option descriptions and the final look.
 */
const ChoiceChips = <T extends string | number>({
  'aria-labelledby': labelledBy,
  onValueChange,
  options,
  other,
  size = 'md',
  value,
}: ChoiceChipsProps<T>) => {
  const id = useId();
  const [otherChosen, setOtherChosen] = useState(false);
  const index = options.findIndex((option) => option.value === value);
  const showOther = other !== undefined && (otherChosen || (value !== null && index === -1));
  const selected = showOther ? OTHER : index === -1 ? null : String(index);

  return (
    <>
      <RadioGroup<string | null>
        aria-labelledby={labelledBy}
        onValueChange={(next) => {
          if (next === OTHER) {
            setOtherChosen(true);
            return;
          }
          setOtherChosen(false);
          const option = next === null ? undefined : options[Number(next)];
          if (option) {
            onValueChange(option.value);
          }
        }}
        value={selected}
        {...stylexProps(styles.group)}
      >
        {options.map((option, optionIndex) => (
          <Radio.Root
            className={(state) =>
              stylexProps(
                styles.chip,
                size === 'sm' && styles.chipSmall,
                state.checked && styles.chipChecked,
                state.disabled && styles.chipDisabled,
              ).className
            }
            disabled={option.disabled}
            key={String(option.value)}
            value={String(optionIndex)}
          >
            {option.label}
          </Radio.Root>
        ))}
        {other && (
          <Radio.Root
            className={(state) =>
              stylexProps(
                styles.chip,
                size === 'sm' && styles.chipSmall,
                state.checked && styles.chipChecked,
              ).className
            }
            value={OTHER}
          >
            {other.label}
          </Radio.Root>
        )}
      </RadioGroup>
      {showOther && other.render({ autoFocus: otherChosen, id: `${id}-other` })}
    </>
  );
};

export { ChoiceChips };
