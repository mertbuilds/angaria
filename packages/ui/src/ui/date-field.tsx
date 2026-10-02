'use client';

import type { CalendarDate } from '@internationalized/date';
import { create, props as stylexProps } from '@stylexjs/stylex';
import {
  DateField as DateFieldPrimitive,
  DateInput,
  DateSegment,
} from 'react-aria-components/DateField';
import { I18nProvider } from 'react-aria-components/I18nProvider';
import { colors, optional, radius } from '../lib/tokens.stylex.ts';

const styles = create({
  input: {
    alignItems: 'center',
    backgroundColor: optional.inputBackground,
    borderColor: colors.input,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.foreground,
    display: 'flex',
    fontSize: '0.875rem',
    fontVariantNumeric: 'tabular-nums',
    height: '2.5rem',
    paddingInline: '1rem',
    width: '100%',
  },
  inputInvalid: {
    borderColor: colors.destructive,
  },
  segment: {
    borderRadius: '0.25rem',
    outline: 'none',
    paddingInline: '1px',
  },
  segmentFocused: {
    backgroundColor: colors.accent,
  },
  segmentPlaceholder: {
    color: colors.mutedForeground,
  },
});

/** A quick pick in the date popover, e.g. Bugün or Geçen ayın son günü. */
export interface DatePreset {
  date: (today: CalendarDate) => CalendarDate;
  label: string;
}

export interface DateFieldProps {
  'aria-describedby'?: string | undefined;
  id: string;
  invalid?: boolean | undefined;
  maxValue?: CalendarDate | undefined;
  minValue?: CalendarDate | undefined;
  onChange: (date: CalendarDate | null) => void;
  /** Reads the popover's text line ("dün", "15.10"); null when it does not understand it. */
  parseText?: ((text: string, today: CalendarDate) => CalendarDate | null) | undefined;
  presets?: ReadonlyArray<DatePreset> | undefined;
  /** Shown under the popover's text line. */
  textHint?: string | undefined;
  value: CalendarDate | null;
}

/**
 * A Turkish date in day, month and year segments.
 * Not implemented yet: the calendar popover with its text line and presets.
 */
const DateField = ({
  'aria-describedby': describedBy,
  id,
  invalid = false,
  maxValue,
  minValue,
  onChange,
  parseText: _parseText,
  presets: _presets,
  textHint: _textHint,
  value,
}: DateFieldProps) => (
  <I18nProvider locale="tr-TR">
    <DateFieldPrimitive<CalendarDate>
      {...(describedBy ? { 'aria-describedby': describedBy } : {})}
      id={id}
      isInvalid={invalid}
      maxValue={maxValue ?? null}
      minValue={minValue ?? null}
      onChange={onChange}
      value={value}
    >
      <DateInput
        className={stylexProps(styles.input, invalid && styles.inputInvalid).className ?? ''}
      >
        {(segment) => (
          <DateSegment
            className={({ isFocused, isPlaceholder }) =>
              stylexProps(
                styles.segment,
                isPlaceholder && styles.segmentPlaceholder,
                isFocused && styles.segmentFocused,
              ).className ?? ''
            }
            segment={segment}
          />
        )}
      </DateInput>
    </DateFieldPrimitive>
  </I18nProvider>
);

export { DateField };
