'use client';

import { OTPField } from '@base-ui/react/otp-field';
import { create, props as stylexProps } from '@stylexjs/stylex';
import { useId } from 'react';
import { colors, fontMetrics, optional, radius } from '../lib/tokens.stylex.ts';

const styles = create({
  root: {
    display: 'flex',
    gap: '0.5rem',
  },
  slot: {
    backgroundColor: optional.inputBackground,
    borderColor: {
      ':focus-visible': colors.ring,
      ':hover': { '@media (hover: hover)': optional.inputHover, default: null },
      default: colors.input,
    },
    borderRadius: radius.md,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: {
      ':focus-visible': `0 0 0 1px ${colors.ring}`,
      default: 'none',
    },
    boxSizing: 'border-box',
    caretColor: colors.ring,
    color: colors.foreground,
    fontFamily: 'inherit',
    // Proportional figures: Suisse Intl's tabular 1 has a foot, like a mono font's.
    fontSize: '1.125rem',
    height: '2.75rem',
    opacity: {
      ':disabled': 0.5,
      default: 1,
    },
    outline: 'none',
    padding: 0,
    // The digit's caps on the middle of the slot.
    paddingTop: `calc(2 * ${fontMetrics.capOffset})`,
    textAlign: 'center',
    width: '2.5rem',
  },
  slotInvalid: {
    borderColor: colors.destructive,
    boxShadow: {
      ':focus-visible': `0 0 0 1px ${colors.destructive}`,
      default: `0 0 0 3px color-mix(in oklab, ${colors.destructive} 20%, transparent)`,
    },
  },
  // Six digits read as two groups of three.
  slotSplit: {
    marginInlineStart: '0.5rem',
  },
});

export interface OTPInputProps {
  /** Every slot points here: the field's error or hint. */
  'aria-describedby'?: string | undefined;
  /** The name when no <label htmlFor={id}> names the field. */
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
  disabled?: boolean | undefined;
  /** The first slot's id, for <label htmlFor> and focusing; later slots are `{id}-2` and on. */
  id?: string | undefined;
  invalid?: boolean | undefined;
  length: number;
  /** Once every slot is filled, typed or pasted. */
  onComplete: (value: string) => void;
  onValueChange: (value: string) => void;
  value: string;
}

/**
 * A one-time code in `length` digit slots. Typing moves to the next slot and
 * a paste fills them all; spaces and other non-digits are dropped
 * (`123 456`). The first slot offers the SMS code to autofill.
 */
const OTPInput = ({
  'aria-describedby': describedBy,
  'aria-label': label,
  'aria-labelledby': labelledBy,
  disabled,
  id,
  invalid,
  length,
  onComplete,
  onValueChange,
  value,
}: OTPInputProps) => {
  const labelId = useId();
  // Base UI names the first slot through a label only, never aria-label.
  const firstLabelledBy = labelledBy ?? (label ? labelId : undefined);
  const split = length >= 6 && length % 2 === 0 ? length / 2 : -1;
  return (
    <>
      {label && !labelledBy && (
        <span hidden id={labelId}>
          {label}
        </span>
      )}
      <OTPField.Root
        aria-labelledby={firstLabelledBy}
        autoComplete="one-time-code"
        disabled={disabled}
        id={id}
        length={length}
        onValueChange={(next) => onValueChange(next)}
        onValueComplete={(next) => onComplete(next)}
        validationType="numeric"
        value={value}
        {...stylexProps(styles.root)}
      >
        {Array.from({ length }, (_, index) => (
          <OTPField.Input
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-label={index === 0 ? undefined : `${index + 1}. hane`}
            aria-labelledby={index === 0 ? firstLabelledBy : undefined}
            key={index}
            {...stylexProps(
              styles.slot,
              index === split && styles.slotSplit,
              invalid && styles.slotInvalid,
            )}
          />
        ))}
      </OTPField.Root>
    </>
  );
};

export { OTPInput };
