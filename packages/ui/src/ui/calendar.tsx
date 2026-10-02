'use client';

import type { CalendarDate } from '@internationalized/date';
import { create, props as stylexProps } from '@stylexjs/stylex';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import {
  Button,
  Calendar as CalendarPrimitive,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Heading,
} from 'react-aria-components/Calendar';
import { I18nProvider } from 'react-aria-components/I18nProvider';
import { colors, radius } from '../lib/tokens.stylex.ts';

const cellSize = '2.25rem';
const weekdayHeight = '1.75rem';

// No transitions anywhere here: arrow keys move the focus a day at a time and
// must feel instant.
const styles = create({
  button: {
    alignItems: 'center',
    backgroundColor: {
      ':hover': colors.muted,
      default: 'transparent',
    },
    borderRadius: radius.full,
    borderWidth: 0,
    boxShadow: {
      ':focus-visible': `0 0 0 2px ${colors.ring}`,
      default: 'none',
    },
    color: colors.foreground,
    cursor: 'pointer',
    display: 'inline-flex',
    height: '2rem',
    justifyContent: 'center',
    outline: 'none',
    padding: 0,
    width: '2rem',
  },
  buttonDisabled: {
    cursor: 'default',
    opacity: 0.4,
  },
  cell: {
    alignItems: 'center',
    borderRadius: radius.full,
    boxSizing: 'border-box',
    cursor: 'pointer',
    display: 'flex',
    fontSize: '0.875rem',
    fontVariantNumeric: 'tabular-nums',
    height: cellSize,
    justifyContent: 'center',
    outline: 'none',
    width: cellSize,
  },
  cellDisabled: {
    color: colors.mutedForeground,
    cursor: 'default',
    opacity: 0.4,
  },
  // Inside the circle, so it shows on the chosen day's fill too: the ring,
  // then a gap of the popover's color.
  cellFocused: {
    boxShadow: `inset 0 0 0 2px ${colors.ring}, inset 0 0 0 4px ${colors.popover}`,
  },
  cellHovered: {
    backgroundColor: colors.muted,
  },
  cellOutside: {
    visibility: 'hidden',
  },
  cellSelected: {
    backgroundColor: colors.primary,
    color: colors.primaryForeground,
  },
  cellToday: {
    boxShadow: `inset 0 0 0 1px ${colors.input}`,
  },
  grid: {
    borderCollapse: 'collapse',
    borderSpacing: 0,
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.25rem',
  },
  heading: {
    fontSize: '0.875rem',
    fontWeight: 500,
    margin: 0,
  },
  weekday: {
    color: colors.mutedForeground,
    fontSize: '0.75rem',
    fontWeight: 400,
    height: weekdayHeight,
    padding: 0,
  },
  // Room for six weeks in every month, so moving between months of four, five
  // and six weeks never changes the calendar's height.
  weeks: {
    minHeight: `calc(${weekdayHeight} + 6 * ${cellSize})`,
  },
});

export interface CalendarProps {
  maxValue?: CalendarDate | undefined;
  minValue?: CalendarDate | undefined;
  onChange: (date: CalendarDate) => void;
  value: CalendarDate | null;
}

/**
 * A month grid to pick a day, weeks from Monday. Arrow keys move by day,
 * Page Up/Down by month, Enter picks.
 */
const Calendar = ({ maxValue, minValue, onChange, value }: CalendarProps) => (
  <I18nProvider locale="tr-TR">
    <CalendarPrimitive<CalendarDate>
      maxValue={maxValue ?? null}
      minValue={minValue ?? null}
      onChange={onChange}
      value={value}
    >
      <header {...stylexProps(styles.header)}>
        <Button
          className={({ isDisabled }) =>
            stylexProps(styles.button, isDisabled && styles.buttonDisabled).className ?? ''
          }
          slot="previous"
        >
          <ChevronLeftIcon aria-hidden size={16} />
        </Button>
        <Heading className={stylexProps(styles.heading).className ?? ''} />
        <Button
          className={({ isDisabled }) =>
            stylexProps(styles.button, isDisabled && styles.buttonDisabled).className ?? ''
          }
          slot="next"
        >
          <ChevronRightIcon aria-hidden size={16} />
        </Button>
      </header>
      <div {...stylexProps(styles.weeks)}>
        <CalendarGrid className={stylexProps(styles.grid).className ?? ''} weekdayStyle="short">
          <CalendarGridHeader>
            {(day) => (
              <CalendarHeaderCell className={stylexProps(styles.weekday).className ?? ''}>
                {day}
              </CalendarHeaderCell>
            )}
          </CalendarGridHeader>
          <CalendarGridBody>
            {(date) => (
              <CalendarCell
                className={({
                  isDisabled,
                  isFocusVisible,
                  isHovered,
                  isOutsideMonth,
                  isSelected,
                  isToday,
                  isUnavailable,
                }) =>
                  stylexProps(
                    styles.cell,
                    isToday && styles.cellToday,
                    isHovered && !isSelected && styles.cellHovered,
                    isSelected && styles.cellSelected,
                    isFocusVisible && styles.cellFocused,
                    (isDisabled || isUnavailable) && styles.cellDisabled,
                    isOutsideMonth && styles.cellOutside,
                  ).className ?? ''
                }
                date={date}
              />
            )}
          </CalendarGridBody>
        </CalendarGrid>
      </div>
    </CalendarPrimitive>
  </I18nProvider>
);

export { Calendar };
