import {
  Button,
  DateField,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  FieldError,
  FieldLabel,
} from '@angaria/ui';
import { spacing } from '@angaria/ui/tokens.stylex';
import type { CalendarDate } from '@internationalized/date';
import { create, props } from '@stylexjs/stylex';
import { CalendarIcon, ChevronDownIcon } from 'lucide-react';
import { useId, useRef, useState, type FormEvent } from 'react';
import {
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

const styles = create({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  // Shrinks to the two date fields side by side.
  dialog: {
    width: 'min-content',
  },
  // Each column as wide as its date field; an error wraps under it.
  range: {
    display: 'grid',
    gap: spacing.s4,
    gridTemplateColumns: 'repeat(2, min-content)',
  },
  // The menu trigger carries its own data-slot, so the theme's button icon
  // size does not reach its icons.
  icon: {
    flexShrink: 0,
    height: '1rem',
    width: '1rem',
  },
  menu: {
    minWidth: '11rem',
  },
});

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
}: {
  initial: DateRange;
  onApply: (range: DateRange) => void;
}) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [start, setStart] = useState(() => gibToCalendarDate(initial.start));
  const [end, setEnd] = useState(() => gibToCalendarDate(initial.end));
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

  return (
    <form onSubmit={submit} ref={formRef} {...props(styles.form)}>
      <DialogHeader>
        <DialogTitle>Özel tarih aralığı</DialogTitle>
        <DialogDescription>
          Bu iki tarih arasındaki faturalar listelenir, iki gün de dahil.
        </DialogDescription>
      </DialogHeader>
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
            onChange={setStart}
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
            minValue={start ?? undefined}
            onChange={setEnd}
            parseText={parseText}
            textHint={DATE_TEXT_HINT}
            value={end}
          />
          {errors.end && <FieldError id={`${id}-end-error`}>{errors.end}</FieldError>}
        </Field>
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Vazgeç</DialogClose>
        <Button type="submit">Uygula</Button>
      </DialogFooter>
    </form>
  );
}

/** The list's date range: Bu ay, Geçen ay, Son 3 ay, or Özel in a dialog. */
export function DateRangeMenu({
  onChange,
  value,
}: {
  onChange: (range: DateRange) => void;
  value: DateRange;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  // Today as of opening the screen, to tell which preset the range is.
  const [today] = useState(() => new Date());
  const preset = rangePreset(value, today);
  const label = DATE_PRESETS.find((item) => item.value === preset)?.label ?? rangeLabel(value);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button aria-label={`Tarih aralığı: ${label}`} variant="outline" />}
        >
          <CalendarIcon {...props(styles.icon)} />
          {label}
          <ChevronDownIcon {...props(styles.icon)} />
        </DropdownMenuTrigger>
        <DropdownMenuContent style={styles.menu}>
          <DropdownMenuRadioGroup
            onValueChange={(next: DatePreset | 'ozel') => {
              if (next !== 'ozel') {
                onChange(presetRange(next, new Date()));
              }
            }}
            value={preset ?? 'ozel'}
          >
            {DATE_PRESETS.map((item) => (
              <DropdownMenuRadioItem closeOnClick key={item.value} value={item.value}>
                {item.label}
              </DropdownMenuRadioItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuRadioItem closeOnClick onClick={() => setCustomOpen(true)} value="ozel">
              Özel
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={setCustomOpen} open={customOpen}>
        <DialogContent showCloseButton={false} style={styles.dialog}>
          {customOpen && (
            <CustomRangeForm
              initial={value}
              onApply={(range) => {
                onChange(range);
                setCustomOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
