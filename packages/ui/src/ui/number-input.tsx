'use client';

import { useState, type ReactNode } from 'react';
import { Input, type InputProps } from './input.tsx';

export type NumberInputProps = Omit<
  InputProps,
  'defaultValue' | 'max' | 'min' | 'step' | 'type' | 'value'
> & {
  /** Evaluates `3*8`, `90000/12` or `1200+15%` on Enter and blur. Default true. */
  allowExpressions?: boolean | undefined;
  /** Shows 0 as an empty field with the placeholder. */
  blankZero?: boolean | undefined;
  /** The text a value shows once the field is left. */
  format: (value: number) => string;
  /** The ↑/↓ step with Shift. Default `step * 10`. */
  largeStep?: number | undefined;
  max?: number | undefined;
  min?: number | undefined;
  /** Every change: the parsed value, NaN while the text does not parse. */
  onValueChange: (value: number) => void;
  /** The number in `text`, or null when it does not parse. */
  parse: (text: string) => number | null;
  /** The ↑/↓ step. */
  step?: number | undefined;
  /** Small − and + buttons inside the field. */
  steppers?: boolean | undefined;
  /** Shown inside the field's end, e.g. ₺ or %. */
  suffix?: ReactNode;
  /** NaN while the text does not parse. */
  value: number;
};

/**
 * A number field that keeps the text as typed and stores the parsed value.
 * Not implemented yet: expressions, ↑/↓ steps, min and max, the suffix and the
 * steppers.
 */
const NumberInput = ({
  allowExpressions: _allowExpressions,
  blankZero = false,
  format,
  largeStep: _largeStep,
  max: _max,
  min: _min,
  onBlur,
  onChange,
  onValueChange,
  parse,
  step: _step,
  steppers: _steppers,
  suffix: _suffix,
  value,
  ...props
}: NumberInputProps) => {
  const show = (number: number) =>
    Number.isNaN(number) || (blankZero && number === 0) ? '' : format(number);
  const [text, setText] = useState(() => show(value));
  const [shown, setShown] = useState(value);

  // A value set elsewhere replaces the text.
  if (!Object.is(shown, value)) {
    setShown(value);
    if (!Object.is(parse(text) ?? Number.NaN, value)) {
      setText(show(value));
    }
  }

  return (
    <Input
      autoComplete="off"
      inputMode="decimal"
      {...props}
      onBlur={(event) => {
        onBlur?.(event);
        if (!Number.isNaN(value)) {
          setText(show(value));
        }
      }}
      onChange={(event) => {
        onChange?.(event);
        setText(event.target.value);
        const next = parse(event.target.value) ?? Number.NaN;
        setShown(next);
        onValueChange(next);
      }}
      type="text"
      value={text}
    />
  );
};

export { NumberInput };
