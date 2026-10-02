'use client';

import { Popover } from '@base-ui/react/popover';
import { DateFormatter, getLocalTimeZone, today as todayIn } from '@internationalized/date';
import type { CalendarDate } from '@internationalized/date';
import { create, props as stylexProps } from '@stylexjs/stylex';
import { CalendarIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  DateField as DateFieldPrimitive,
  DateInput,
  DateSegment,
} from 'react-aria-components/DateField';
import { I18nProvider } from 'react-aria-components/I18nProvider';
import { popupMotion, popupStyles, useHeldPlacement } from '../lib/popup.ts';
import { colors, optional, radius } from '../lib/tokens.stylex.ts';
import { Calendar } from './calendar.tsx';
import { Input } from './input.tsx';
import { Kbd } from './kbd.tsx';

const styles = create({
  // React Aria's field wrapper stays out of the pill's flex layout.
  contents: {
    display: 'contents',
  },
  field: {
    alignItems: 'center',
    backgroundColor: optional.inputBackground,
    borderColor: {
      ':focus-within': colors.ring,
      default: colors.input,
    },
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: {
      ':focus-within': `0 0 0 1px ${colors.ring}`,
      default: 'none',
    },
    boxSizing: 'border-box',
    color: colors.foreground,
    display: 'flex',
    fontSize: '0.875rem',
    fontVariantNumeric: 'tabular-nums',
    // 40px pill, like Input; the calendar button sits inside its right end.
    height: '2.5rem',
    paddingInlineEnd: '0.25rem',
    width: '100%',
  },
  // Like Input: focused, the glow tightens to a 1px ring.
  fieldInvalid: {
    borderColor: colors.destructive,
    boxShadow: {
      ':focus-within': `0 0 0 1px ${colors.destructive}`,
      default: `0 0 0 3px color-mix(in oklab, ${colors.destructive} 20%, transparent)`,
    },
  },
  // The segments fill the pill, so a click anywhere left of the button lands in them.
  input: {
    alignItems: 'center',
    alignSelf: 'stretch',
    display: 'flex',
    flex: 1,
    minWidth: 0,
    paddingInlineStart: '1rem',
  },
  literal: {
    color: colors.mutedForeground,
    paddingInline: '1px',
  },
  popup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    padding: '0.75rem',
    width: 'max-content',
  },
  preset: {
    backgroundColor: {
      ':hover': colors.muted,
      default: 'transparent',
    },
    borderColor: colors.border,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: {
      ':focus-visible': `0 0 0 1px ${colors.ring}`,
      default: 'none',
    },
    color: colors.foreground,
    cursor: {
      ':disabled': 'not-allowed',
      default: 'pointer',
    },
    fontFamily: 'inherit',
    fontSize: '0.8rem',
    height: '1.75rem',
    opacity: {
      ':disabled': 0.5,
      default: 1,
    },
    outline: 'none',
    paddingInline: '0.75rem',
  },
  presets: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
    // As wide as the calendar, so long labels wrap instead of widening the popover.
    maxWidth: '15.75rem',
  },
  preview: {
    alignItems: 'center',
    color: colors.mutedForeground,
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: '0.8rem',
    gap: '0.25rem 0.375rem',
    lineHeight: 1.4,
    margin: 0,
    maxWidth: '15.75rem',
    // Two lines (a date and its range problem wrap to two), so typing never
    // changes the popover's height.
    minHeight: 'calc(2.8em + 0.25rem)',
  },
  previewDate: {
    color: colors.foreground,
  },
  segment: {
    borderRadius: '0.25rem',
    outline: 'none',
    paddingInline: '1px',
  },
  segmentFocused: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 20%, transparent)`,
  },
  segmentPlaceholder: {
    color: colors.mutedForeground,
  },
  text: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  textLabel: {
    color: colors.mutedForeground,
    fontSize: '0.75rem',
  },
  trigger: {
    alignItems: 'center',
    backgroundColor: {
      ':focus-visible': colors.muted,
      ':hover': colors.muted,
      default: 'transparent',
    },
    borderRadius: radius.full,
    borderWidth: 0,
    color: colors.mutedForeground,
    cursor: 'pointer',
    display: 'inline-flex',
    flexShrink: 0,
    height: '2rem',
    justifyContent: 'center',
    outlineColor: colors.ring,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: '2px',
    padding: 0,
    width: '2rem',
  },
});

/** A quick pick in the date popover, e.g. Bugün or Geçen ayın son günü. */
export interface DatePreset {
  date: (today: CalendarDate) => CalendarDate;
  label: string;
}

export interface DateFieldProps {
  'aria-describedby'?: string | undefined;
  /** The field's name. A `<label for>` does not name the segments, so pass this or `aria-labelledby`. */
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
  id: string;
  invalid?: boolean | undefined;
  maxValue?: CalendarDate | undefined;
  minValue?: CalendarDate | undefined;
  /** Focus left the segments. */
  onBlur?: (() => void) | undefined;
  onChange: (date: CalendarDate | null) => void;
  /** Reads the popover's text line ("dün", "15.10"); null when it does not understand it. */
  parseText?: ((text: string, today: CalendarDate) => CalendarDate | null) | undefined;
  presets?: ReadonlyArray<DatePreset> | undefined;
  /** Shown under the popover's text line. */
  textHint?: string | undefined;
  value: CalendarDate | null;
}

const copy = {
  enter: '↵',
  textLabel: 'Tarihi yaz',
  textPlaceholder: 'dün, cuma, 15.10, geçen ay sonu…',
  trigger: 'Takvimi aç',
  unreadable: 'Tarihi anlayamadım.',
};

const previewFormat = new DateFormatter('tr-TR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  weekday: 'long',
  year: 'numeric',
});

/** "9 Eki 2026, Cuma", or "9 Eki 2026" without the weekday. */
function formatPreview(date: CalendarDate, weekday = true) {
  const parts = Object.fromEntries(
    previewFormat.formatToParts(date.toDate('UTC')).map((part) => [part.type, part.value]),
  );
  const day = `${parts.day} ${parts.month} ${parts.year}`;
  return weekday ? `${day}, ${parts.weekday}` : day;
}

const sameDay = (a: CalendarDate | null, b: CalendarDate | null) =>
  a === b || (a !== null && b !== null && a.compare(b) === 0);

/**
 * The value, kept as the same object while it names the same day: React Aria
 * resets half-typed segments whenever the value's identity changes.
 */
function useSameDay(value: CalendarDate | null) {
  const [kept, setKept] = useState(value);
  if (!sameDay(value, kept)) {
    setKept(value);
    return value;
  }
  return kept;
}

/** Why a typed date cannot be picked, or null when it can. */
function rangeProblem(date: CalendarDate, min?: CalendarDate, max?: CalendarDate) {
  if (max && date.compare(max) > 0) {
    return `En geç ${formatPreview(max, false)} seçebilirsin.`;
  }
  if (min && date.compare(min) < 0) {
    return `En erken ${formatPreview(min, false)} seçebilirsin.`;
  }
  return null;
}

/** A key that types one character, not a shortcut. */
const typesText = (event: KeyboardEvent) =>
  event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;

/**
 * A Turkish date in day, month and year segments (gg.aa.yyyy), ↑/↓ per
 * segment, with a calendar button. Its popover reads typed text ("dün",
 * "15.10") through `parseText`, offers `presets`, then the month grid.
 * Typing a letter in the segments or Alt+↓ opens it.
 */
const DateField = ({
  'aria-describedby': describedBy,
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
  id,
  invalid = false,
  maxValue,
  minValue,
  onBlur,
  onChange,
  parseText,
  presets,
  textHint,
  value,
}: DateFieldProps) => {
  const fieldRef = useRef<HTMLDivElement>(null);
  const segmentsRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const textId = useId();
  const previewId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  // Set by Enter on text it cannot read; typing clears it, so half-typed
  // words are never called wrong.
  const [unreadable, setUnreadable] = useState(false);
  const [today, setToday] = useState(() => todayIn(getLocalTimeZone()));
  // A year typed so far ("2", "26") stays here until the field is left, then
  // a two-digit year becomes 20xx; the form never sees year 26.
  const [pendingYear, setPendingYear] = useState<CalendarDate | null>(null);
  const kept = useSameDay(value);
  const shown = pendingYear ?? kept;
  const placement = useHeldPlacement('bottom', 'start');

  // A <label for={id}> names nothing on the segments' group, so make its
  // click focus the first segment like a native input's label would.
  useEffect(() => {
    const labels = document.querySelectorAll(`label[for="${CSS.escape(id)}"]`);
    const focusFirst = () =>
      segmentsRef.current?.querySelector<HTMLElement>('[role="spinbutton"]')?.focus();
    for (const label of labels) {
      label.addEventListener('click', focusFirst);
    }
    return () => {
      for (const label of labels) {
        label.removeEventListener('click', focusFirst);
      }
    };
  }, [id]);

  const emit = (date: CalendarDate | null) => {
    if (!sameDay(date, value)) {
      onChange(date);
    }
  };

  const change = (date: CalendarDate | null) => {
    if (date && date.year < 1000) {
      setPendingYear(date);
      return;
    }
    setPendingYear(null);
    emit(date);
  };

  const settleYear = () => {
    if (pendingYear) {
      setPendingYear(null);
      emit(pendingYear.year < 100 ? pendingYear.add({ years: 2000 }) : pendingYear);
    }
  };

  const openPopover = (seed: string) => {
    setText(seed);
    setUnreadable(false);
    setToday(todayIn(getLocalTimeZone()));
    setOpen(true);
  };

  const commit = (date: CalendarDate) => {
    setPendingYear(null);
    setOpen(false);
    emit(date);
  };

  const onFieldKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!segmentsRef.current?.contains(event.target as Node)) {
      return;
    }
    if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      openPopover('');
    } else if (event.key === 'Enter') {
      settleYear();
    } else if (parseText && open && typesText(event)) {
      // Keys typed before the text line takes focus still belong to it.
      event.preventDefault();
      const key = event.key;
      setText((current) => current + key);
    } else if (parseText && typesText(event) && /^[\p{L}+-]$/u.test(event.key)) {
      // A letter (or a sign, for "+3") starts the text line instead of
      // going into the segment.
      event.preventDefault();
      openPopover(event.key);
    }
  };

  const parsed = parseText && text.trim() ? parseText(text, today) : null;
  const problem = parsed ? rangeProblem(parsed, minValue, maxValue) : null;

  const onTextKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (parsed && !problem) {
        commit(parsed);
      } else if (!parsed && text.trim()) {
        setUnreadable(true);
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      popupRef.current?.querySelector<HTMLElement>('[role="grid"] [tabindex="0"]')?.focus();
    }
  };

  const preview = parsed ? (
    <>
      <span {...stylexProps(styles.previewDate)}>{formatPreview(parsed)}</span>
      {problem ?? <Kbd aria-hidden>{copy.enter}</Kbd>}
    </>
  ) : unreadable ? (
    `${copy.unreadable}${textHint ? ` ${textHint}` : ''}`
  ) : (
    textHint
  );

  return (
    <Popover.Root onOpenChange={(next) => (next ? openPopover('') : setOpen(false))} open={open}>
      <div
        onKeyDown={onFieldKeyDown}
        ref={fieldRef}
        {...stylexProps(styles.field, invalid && styles.fieldInvalid)}
      >
        <I18nProvider locale="tr-TR">
          <DateFieldPrimitive<CalendarDate>
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
            {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}
            className={stylexProps(styles.contents).className ?? ''}
            id={id}
            isInvalid={invalid}
            maxValue={maxValue ?? null}
            minValue={minValue ?? null}
            onBlur={() => {
              settleYear();
              onBlur?.();
            }}
            onChange={change}
            shouldForceLeadingZeros
            value={shown}
          >
            <DateInput className={stylexProps(styles.input).className ?? ''} ref={segmentsRef}>
              {(segment) => (
                <DateSegment
                  className={({ isFocused, isPlaceholder }) =>
                    stylexProps(
                      segment.type === 'literal' ? styles.literal : styles.segment,
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
        <Popover.Trigger aria-label={copy.trigger} {...stylexProps(styles.trigger)}>
          <CalendarIcon aria-hidden size={16} />
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Positioner
          anchor={fieldRef}
          sideOffset={4}
          {...placement}
          {...stylexProps(popupStyles.positioner)}
        >
          <Popover.Popup
            className={(state) =>
              stylexProps(popupStyles.surface, styles.popup, popupMotion(state.transitionStatus))
                .className
            }
            initialFocus={() =>
              textRef.current ??
              popupRef.current?.querySelector<HTMLElement>('[role="grid"] [tabindex="0"]') ??
              true
            }
            ref={popupRef}
          >
            {parseText && (
              <div {...stylexProps(styles.text)}>
                <label htmlFor={textId} {...stylexProps(styles.textLabel)}>
                  {copy.textLabel}
                </label>
                <Input
                  aria-describedby={previewId}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  id={textId}
                  onChange={(event) => {
                    setText(event.target.value);
                    setUnreadable(false);
                  }}
                  onKeyDown={onTextKeyDown}
                  placeholder={copy.textPlaceholder}
                  ref={textRef}
                  spellCheck={false}
                  value={text}
                />
                <p aria-live="polite" id={previewId} {...stylexProps(styles.preview)}>
                  {preview}
                </p>
              </div>
            )}
            {presets && presets.length > 0 && (
              <div {...stylexProps(styles.presets)}>
                {presets.map((preset) => {
                  const date = preset.date(today);
                  return (
                    <button
                      disabled={rangeProblem(date, minValue, maxValue) !== null}
                      key={preset.label}
                      onClick={() => commit(date)}
                      type="button"
                      {...stylexProps(styles.preset)}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            )}
            <Calendar maxValue={maxValue} minValue={minValue} onChange={commit} value={shown} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};

export { DateField };
