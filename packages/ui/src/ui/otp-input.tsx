'use client';

import { OTPField } from '@base-ui/react/otp-field';
import { create, props as stylexProps } from '@stylexjs/stylex';
import { colors, optional } from '../lib/tokens.stylex.ts';

const styles = create({
  root: {
    display: 'flex',
    gap: '0.5rem',
  },
  slot: {
    backgroundColor: optional.inputBackground,
    borderColor: {
      ':focus-visible': colors.ring,
      default: colors.input,
    },
    borderRadius: '0.5rem',
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.foreground,
    fontFamily: 'inherit',
    fontSize: '1rem',
    fontVariantNumeric: 'tabular-nums',
    height: '2.5rem',
    outline: 'none',
    textAlign: 'center',
    width: '2.25rem',
  },
  slotInvalid: {
    borderColor: colors.destructive,
  },
});

export interface OTPInputProps {
  invalid?: boolean | undefined;
  length: number;
  /** Once every slot is filled. */
  onComplete: (value: string) => void;
  onValueChange: (value: string) => void;
  value: string;
}

/** A one-time code in `length` digit slots. Not implemented yet: the final look. */
const OTPInput = ({ invalid, length, onComplete, onValueChange, value }: OTPInputProps) => (
  <OTPField.Root
    autoComplete="one-time-code"
    length={length}
    onValueChange={(next) => onValueChange(next)}
    onValueComplete={(next) => onComplete(next)}
    validationType="numeric"
    value={value}
    {...stylexProps(styles.root)}
  >
    {Array.from({ length }, (_, index) => (
      <OTPField.Input
        aria-invalid={invalid || undefined}
        key={index}
        {...stylexProps(styles.slot, invalid && styles.slotInvalid)}
      />
    ))}
  </OTPField.Root>
);

export { OTPInput };
