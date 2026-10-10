import {
  Button,
  DateField,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  FieldError,
  FieldLabel,
  Kbd,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  RangeCalendar,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@angaria/ui';
import { spacing } from '@angaria/ui/tokens.stylex';
import { getLocalTimeZone, today as todayIn, type CalendarDate } from '@internationalized/date';
import { create, props } from '@stylexjs/stylex';
import { CalendarIcon, ChevronDownIcon } from 'lucide-react';
import { Fragment, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  DATE_PRESET_GROUPS,
  DATE_PRESETS,
  MAX_RANGE_DAYS,
  presetRange,
  rangePreset,
  type DatePreset,
  type DateRange,
} from '@/lib/invoices.ts';
import {
  calendarDateToGIB,
  DATE_TEXT_HINT,
  gibToCalendarDate,
  parseTurkishDate,
} from '@/lib/tr-date.ts';
import { parseGIB } from '@/lib/utils.ts';

/** Opens the period menu from anywhere on Faturalar but a text field. */
const MENU_KEY = 'T';
const CUSTOM_KEY = 'Ö';

const styles = create({
  calendar: {
    alignSelf: 'center',
  },
  // As wide as the two date fields side by side.
  custom: {
    width: 'min-content',
  },
  footer: {
    display: 'flex',
    gap: spacing.s2,
    justifyContent: 'flex-end',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  // The menu trigger carries its own data-slot, so the theme's button icon
  // size does not reach its icons.
  icon: {
    flexShrink: 0,
    height: '1rem',
    width: '1rem',
  },
  menu: {
    minWidth: '12rem',
  },
  // Each column as wide as its date field; an error wraps under it.
  range: {
    display: 'grid',
    gap: spacing.s4,
    gridTemplateColumns: 'repeat(2, min-content)',
  },
});

/** A key typed into a text field, a date segment or a list's search is not a shortcut. */
const typingIn = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.isContentEditable ||
    element?.matches?.('input, textarea, select, [role="spinbutton"], [role="combobox"]'),
  );
};

const longDate = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' });

/** "1 Eylül – 15 Eylül 2026", or the GİB text when a date does not parse. */
function rangeLabel({ end, start }: DateRange) {
  const from = parseGIB(start);
  const to = parseGIB(end);
  return from && to ? longDate.formatRange(from, to) : `${start} – ${end}`;
}

/** What is wrong with each end of the range, checked as the user types. */
function rangeErrors(start: CalendarDate | null, end: CalendarDate | null) {
  const errors: { end?: string; start?: string } = {};
  if (!start) {
    errors.start = 'Başlangıç tarihini gir.';
  }
  if (!end) {
    errors.end = 'Bitiş tarihini gir.';
  } else if (start) {
    const days = end.compare(start) + 1;
    if (days < 1) {
      errors.end = 'Bitiş tarihi başlangıçtan önce olamaz.';
    } else if (days > MAX_RANGE_DAYS) {
      errors.end = 'En fazla bir yıllık aralık seçebilirsin.';
    }
  }
  return errors;
}

const parseText = (text: string, today: CalendarDate) => parseTurkishDate(text, today, 'past');

function CustomRangeForm({
  initial,
  onApply,
  onCancel,
}: {
  initial: DateRange;
  onApply: (range: DateRange) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [today] = useState(() => todayIn(getLocalTimeZone()));
  const [start, setStart] = useState(() => gibToCalendarDate(initial.start));
  const [end, setEnd] = useState(() => gibToCalendarDate(initial.end));
  // The calendar shows the month of the date last typed or picked.
  const [focused, setFocused] = useState(() => end ?? today);
  const errors = rangeErrors(start, end);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (start && end && !errors.start && !errors.end) {
      onApply({ end: calendarDateToGIB(end), start: calendarDateToGIB(start) });
    } else {
      formRef.current
        ?.querySelector<HTMLElement>('[role="spinbutton"][aria-invalid="true"]')
        ?.focus();
    }
  };

  const typed = (set: (date: CalendarDate | null) => void) => (date: CalendarDate | null) => {
    set(date);
    if (date) {
      setFocused(date);
    }
  };

  return (
    <form onSubmit={submit} ref={formRef} {...props(styles.form)}>
      <PopoverHeader>
        <PopoverTitle>Özel tarih aralığı</PopoverTitle>
        <PopoverDescription>
          Bu iki tarih arasındaki faturalar listelenir, iki gün de dahil.
        </PopoverDescription>
      </PopoverHeader>
      <div {...props(styles.range)}>
        <Field data-invalid={errors.start ? true : undefined}>
          <FieldLabel htmlFor={`${id}-start`} id={`${id}-start-label`}>
            Başlangıç
          </FieldLabel>
          <DateField
            aria-describedby={errors.start ? `${id}-start-error` : undefined}
            aria-labelledby={`${id}-start-label`}
            id={`${id}-start`}
            invalid={Boolean(errors.start)}
            maxValue={today}
            onChange={typed(setStart)}
            parseText={parseText}
            textHint={DATE_TEXT_HINT}
            value={start}
          />
          {errors.start && <FieldError id={`${id}-start-error`}>{errors.start}</FieldError>}
        </Field>
        <Field data-invalid={errors.end ? true : undefined}>
          <FieldLabel htmlFor={`${id}-end`} id={`${id}-end-label`}>
            Bitiş
          </FieldLabel>
          <DateField
            aria-describedby={errors.end ? `${id}-end-error` : undefined}
            aria-labelledby={`${id}-end-label`}
            id={`${id}-end`}
            invalid={Boolean(errors.end)}
            maxValue={today}
            minValue={start ?? undefined}
            onChange={typed(setEnd)}
            parseText={parseText}
            textHint={DATE_TEXT_HINT}
            value={end}
          />
          {errors.end && <FieldError id={`${id}-end-error`}>{errors.end}</FieldError>}
        </Field>
      </div>
      <div {...props(styles.calendar)}>
        <RangeCalendar
          focusedValue={focused}
          maxValue={today}
          onChange={(range) => {
            setStart(range.start);
            setEnd(range.end);
          }}
          onFocusChange={setFocused}
          value={start && end && start.compare(end) <= 0 ? { end, start } : null}
        />
      </div>
      <div {...props(styles.footer)}>
        <Button onClick={onCancel} type="button" variant="outline">
          Vazgeç
        </Button>
        <Button type="submit">Uygula</Button>
      </div>
    </form>
  );
}

/**
 * The list's date range: the presets, each with its key, or Özel, a range
 * picked on a calendar or typed. T opens the menu.
 */
export function DateRangeMenu({
  onChange,
  value,
}: {
  onChange: (range: DateRange) => void;
  value: DateRange;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  // Özel opens its popover once the menu has closed, so the menu's focus
  // return to the trigger does not pull the focus out of it.
  const customNext = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Today as of opening the screen, to tell which preset the range is.
  const [today] = useState(() => new Date());
  const preset = rangePreset(value, today);
  const label = DATE_PRESETS.find((item) => item.value === preset)?.label ?? rangeLabel(value);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLocaleLowerCase('tr') !== MENU_KEY.toLocaleLowerCase('tr') ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.isComposing ||
        event.defaultPrevented ||
        typingIn(event.target) ||
        // An open dialog, menu or popover owns the keys.
        document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')
      ) {
        return;
      }
      event.preventDefault();
      setMenuOpen(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <Tooltip>
        <DropdownMenu
          onOpenChange={setMenuOpen}
          onOpenChangeComplete={(open) => {
            if (!open && customNext.current) {
              customNext.current = false;
              setCustomOpen(true);
            }
          }}
          open={menuOpen}
        >
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                ref={triggerRef}
                render={<Button aria-label={`Tarih aralığı: ${label}`} variant="outline" />}
              />
            }
          >
            <CalendarIcon {...props(styles.icon)} />
            {label}
            <ChevronDownIcon {...props(styles.icon)} />
          </TooltipTrigger>
          <DropdownMenuContent style={styles.menu}>
            <DropdownMenuRadioGroup
              onValueChange={(next: DatePreset | 'ozel') => {
                if (next !== 'ozel') {
                  onChange(presetRange(next, new Date()));
                }
              }}
              value={preset ?? 'ozel'}
            >
              {DATE_PRESET_GROUPS.map((group, index) => (
                <Fragment key={group[0]?.value}>
                  {index > 0 && <DropdownMenuSeparator />}
                  {group.map((item) => (
                    <DropdownMenuRadioItem
                      closeOnClick
                      key={item.value}
                      shortcut={item.shortcut}
                      value={item.value}
                    >
                      {item.label}
                    </DropdownMenuRadioItem>
                  ))}
                </Fragment>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuRadioItem
                closeOnClick
                onClick={() => {
                  customNext.current = true;
                }}
                shortcut={CUSTOM_KEY}
                value="ozel"
              >
                Özel
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipContent>
          Tarih aralığı <Kbd>{MENU_KEY}</Kbd>
        </TooltipContent>
      </Tooltip>

      <Popover onOpenChange={setCustomOpen} open={customOpen}>
        <PopoverContent
          align="start"
          anchor={triggerRef}
          finalFocus={triggerRef}
          style={styles.custom}
        >
          {customOpen && (
            <CustomRangeForm
              initial={value}
              onApply={(range) => {
                onChange(range);
                setCustomOpen(false);
              }}
              onCancel={() => setCustomOpen(false)}
            />
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
