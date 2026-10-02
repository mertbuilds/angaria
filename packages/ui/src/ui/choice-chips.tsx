'use client';

import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { create, props as stylexProps } from '@stylexjs/stylex';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { colors, optional, radius } from '../lib/tokens.stylex.ts';

const styles = create({
  chip: {
    alignItems: 'center',
    backgroundColor: {
      ':hover': { '@media (hover: hover)': colors.accent, default: null },
      default: 'transparent',
    },
    borderRadius: radius.full,
    boxSizing: 'border-box',
    color: {
      ':hover': { '@media (hover: hover)': colors.foreground, default: null },
      default: colors.mutedForeground,
    },
    cursor: 'pointer',
    display: 'inline-flex',
    fontSize: '0.875rem',
    justifyContent: 'center',
    minWidth: 0,
    outlineColor: colors.ring,
    outlineOffset: '1px',
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: '2px',
    paddingInline: '0.875rem',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  // Pointer only: a keyboard choice and reduced motion switch at once.
  chipAnimated: {
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '120ms',
    },
    transitionProperty: 'background-color, color, box-shadow',
    transitionTimingFunction: 'ease-out',
  },
  // A primary tint and a 1px ring, never a heavier weight.
  chipChecked: {
    backgroundColor: {
      ':hover': {
        '@media (hover: hover)': `color-mix(in oklab, ${colors.primary} 18%, transparent)`,
        default: null,
      },
      default: `color-mix(in oklab, ${colors.primary} 12%, transparent)`,
    },
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${colors.primary} 55%, transparent)`,
    color: {
      ':hover': { '@media (hover: hover)': optional.primaryInk, default: null },
      default: optional.primaryInk,
    },
  },
  chipDisabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  chipSmall: {
    fontSize: '0.8125rem',
    paddingInline: '0.625rem',
  },
  // A field-like pill: the same height, border and fill as Input.
  group: {
    backgroundColor: optional.inputBackground,
    borderColor: {
      ':hover': { '@media (hover: hover)': optional.inputHover, default: null },
      default: colors.input,
    },
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'inline-grid',
    gap: '2px',
    // Equal-width segments, as wide as the widest label.
    gridAutoColumns: '1fr',
    gridAutoFlow: 'column',
    height: '2.5rem',
    maxWidth: '100%',
    padding: '3px',
  },
  groupDisabled: {
    opacity: 0.5,
  },
  groupInvalid: {
    borderColor: colors.destructive,
    boxShadow: `0 0 0 3px color-mix(in oklab, ${colors.destructive} 20%, transparent)`,
  },
  groupSmall: {
    height: '2rem',
    padding: '2px',
  },
  row: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    minWidth: 0,
  },
});

export interface ChoiceOption<T extends string | number> {
  /** Read with the option by screen readers, and shown on hover. */
  description?: string | undefined;
  disabled?: boolean | undefined;
  label: string;
  value: T;
}

export interface ChoiceChipsProps<T extends string | number> {
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: boolean | undefined;
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
  disabled?: boolean | undefined;
  /** The group's id. */
  id?: string | undefined;
  onValueChange: (value: T | null) => void;
  options: ReadonlyArray<ChoiceOption<T>>;
  /**
   * A last chip ("Diğer") that shows an input for a value outside `options`,
   * inline after the chips. Picking it by pointer, Space or digit focuses the
   * input (`id`); the value stays until the input changes it. The input takes
   * the group's description and invalid state too.
   */
  other?:
    | {
        label: string;
        render: (props: {
          'aria-describedby': string | undefined;
          'aria-invalid': boolean | undefined;
          autoFocus: boolean;
          id: string;
        }) => ReactNode;
      }
    | undefined;
  size?: 'sm' | 'md' | undefined;
  /** A value outside `options` selects `other` and shows its input. */
  value: T | null;
}

const OTHER = 'other';

/**
 * One choice from a few options (seven at most), as a segmented row with radio
 * semantics: one Tab stop, ←/→ move, digits 1-9 pick the n-th chip.
 */
const ChoiceChips = <T extends string | number>({
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  'aria-label': label,
  'aria-labelledby': labelledBy,
  disabled = false,
  id,
  onValueChange,
  options,
  other,
  size = 'md',
  value,
}: ChoiceChipsProps<T>) => {
  const baseId = useId();
  const otherId = `${id ?? baseId}-other`;
  const groupRef = useRef<HTMLDivElement | null>(null);
  // How the last choice was made: pointer presses animate, keys switch at once.
  const modality = useRef<'pointer' | string>('');
  const [pointer, setPointer] = useState(false);
  const [otherChosen, setOtherChosen] = useState(false);
  const [focusOther, setFocusOther] = useState(0);
  const index = options.findIndex((option) => option.value === value);
  const showOther = other !== undefined && (otherChosen || (value !== null && index === -1));
  const selected = showOther ? OTHER : index === -1 ? null : String(index);

  useEffect(() => {
    if (focusOther > 0) {
      document.getElementById(otherId)?.focus();
    }
  }, [focusOther, otherId]);

  const choose = (next: string | null, focusInput: boolean) => {
    if (next === OTHER) {
      setOtherChosen(true);
      if (focusInput) {
        setFocusOther((count) => count + 1);
      }
      return;
    }
    setOtherChosen(false);
    const option = next === null ? undefined : options[Number(next)];
    if (option) {
      onValueChange(option.value);
    }
  };

  const chipStyle = (state: Radio.Root.State) =>
    stylexProps(
      styles.chip,
      size === 'sm' && styles.chipSmall,
      pointer && styles.chipAnimated,
      state.checked && styles.chipChecked,
      state.disabled && !disabled && styles.chipDisabled,
    ).className;

  return (
    <div
      {...stylexProps(styles.row)}
      onKeyDownCapture={(event) => {
        modality.current = event.key;
        setPointer(false);
      }}
      onPointerDownCapture={() => {
        modality.current = 'pointer';
        setPointer(true);
      }}
    >
      <RadioGroup<string | null>
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-label={label}
        aria-labelledby={labelledBy}
        disabled={disabled}
        id={id}
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey || !/^[1-9]$/.test(event.key)) {
            return;
          }
          const chip = Number(event.key) - 1;
          const isOther = other !== undefined && chip === options.length;
          if (!isOther && (chip >= options.length || options[chip]?.disabled)) {
            return;
          }
          event.preventDefault();
          if (!isOther) {
            groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[chip]?.focus();
          }
          choose(isOther ? OTHER : String(chip), true);
        }}
        onValueChange={(next) =>
          // Arrow keys select as they move: they never pull focus into the input.
          choose(next, modality.current === 'pointer' || modality.current === ' ')
        }
        ref={groupRef}
        value={selected}
        {...stylexProps(
          styles.group,
          size === 'sm' && styles.groupSmall,
          disabled && styles.groupDisabled,
          invalid && styles.groupInvalid,
        )}
      >
        {options.map((option, optionIndex) => (
          <Radio.Root
            aria-describedby={option.description ? `${baseId}-${optionIndex}` : undefined}
            className={chipStyle}
            disabled={option.disabled}
            key={String(option.value)}
            title={option.description}
            value={String(optionIndex)}
          >
            {option.label}
            {option.description && (
              <span hidden id={`${baseId}-${optionIndex}`}>
                {option.description}
              </span>
            )}
          </Radio.Root>
        ))}
        {other && (
          <Radio.Root className={chipStyle} value={OTHER}>
            {other.label}
          </Radio.Root>
        )}
      </RadioGroup>
      {showOther &&
        other.render({
          'aria-describedby': describedBy,
          'aria-invalid': invalid || undefined,
          autoFocus: focusOther > 0,
          id: otherId,
        })}
    </div>
  );
};

export { ChoiceChips };
