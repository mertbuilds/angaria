'use client';

import type { CalendarDate } from '@internationalized/date';
import { create, props as stylexProps } from '@stylexjs/stylex';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import {
  Button,
  Calendar as CalendarPrimitive,
  CalendarCell,
  CalendarGrid,
  Heading,
} from 'react-aria-components/Calendar';
import { I18nProvider } from 'react-aria-components/I18nProvider';
import { colors, radius } from '../lib/tokens.stylex.ts';

const styles = create({
  button: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: radius.full,
    borderWidth: 0,
    color: colors.foreground,
    cursor: 'pointer',
    display: 'inline-flex',
    height: '1.75rem',
    justifyContent: 'center',
    width: '1.75rem',
  },
  cell: {
    alignItems: 'center',
    borderRadius: radius.full,
    cursor: 'pointer',
    display: 'flex',
    fontSize: '0.875rem',
    fontVariantNumeric: 'tabular-nums',
    height: '2rem',
    justifyContent: 'center',
    outline: 'none',
    width: '2rem',
  },
  cellDisabled: {
    color: colors.mutedForeground,
    cursor: 'default',
    opacity: 0.5,
  },
  cellFocused: {
    boxShadow: `0 0 0 1px ${colors.ring}`,
  },
  cellOutside: {
    visibility: 'hidden',
  },
  cellSelected: {
    backgroundColor: colors.primary,
    color: colors.primaryForeground,
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  heading: {
    fontSize: '0.875rem',
    fontWeight: 500,
    margin: 0,
  },
});

export interface CalendarProps {
  maxValue?: CalendarDate | undefined;
  minValue?: CalendarDate | undefined;
  onChange: (date: CalendarDate) => void;
  value: CalendarDate | null;
}

/** A month grid to pick a day. Not implemented yet: the final look. */
const Calendar = ({ maxValue, minValue, onChange, value }: CalendarProps) => (
  <I18nProvider locale="tr-TR">
    <CalendarPrimitive<CalendarDate>
      maxValue={maxValue ?? null}
      minValue={minValue ?? null}
      onChange={onChange}
      value={value}
    >
      <header {...stylexProps(styles.header)}>
        <Button className={stylexProps(styles.button).className ?? ''} slot="previous">
          <ChevronLeftIcon aria-hidden size={16} />
        </Button>
        <Heading className={stylexProps(styles.heading).className ?? ''} />
        <Button className={stylexProps(styles.button).className ?? ''} slot="next">
          <ChevronRightIcon aria-hidden size={16} />
        </Button>
      </header>
      <CalendarGrid>
        {(date) => (
          <CalendarCell
            className={({ isDisabled, isFocusVisible, isOutsideMonth, isSelected }) =>
              stylexProps(
                styles.cell,
                isSelected && styles.cellSelected,
                isFocusVisible && styles.cellFocused,
                isDisabled && styles.cellDisabled,
                isOutsideMonth && styles.cellOutside,
              ).className ?? ''
            }
            date={date}
          />
        )}
      </CalendarGrid>
    </CalendarPrimitive>
  </I18nProvider>
);

export { Calendar };
