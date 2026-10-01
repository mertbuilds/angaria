import {
  Button,
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
  FieldGroup,
  FieldLabel,
  Input,
} from '@angaria/ui';
import { spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { CalendarIcon, ChevronDownIcon } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import {
  DATE_PRESETS,
  MAX_RANGE_DAYS,
  presetRange,
  rangePreset,
  type DatePreset,
  type DateRange,
} from '@/lib/invoices.ts';
import { parseGIB } from '@/lib/utils.ts';

const styles = create({
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
    minWidth: '11rem',
  },
});

const DAY = 24 * 60 * 60 * 1000;
const longDate = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' });

// <input type="date"> speaks yyyy-MM-dd, GİB dd/MM/yyyy.
const toInputDate = (gib: string) => gib.split(/[/-]/).toReversed().join('-');
const fromInputDate = (input: string) => input.split('-').toReversed().join('/');

/** "1 Eylül – 15 Eylül 2026", or the GİB text when a date does not parse. */
function rangeLabel({ end, start }: DateRange) {
  const from = parseGIB(start);
  const to = parseGIB(end);
  return from && to ? longDate.formatRange(from, to) : `${start} – ${end}`;
}

function rangeProblem(start: string, end: string) {
  if (!start || !end) {
    return 'Başlangıç ve bitiş tarihini seçin.';
  }
  const days = (Date.parse(end) - Date.parse(start)) / DAY + 1;
  if (days < 1) {
    return 'Bitiş tarihi başlangıçtan önce olamaz.';
  }
  if (days > MAX_RANGE_DAYS) {
    return 'En fazla bir yıllık aralık seçebilirsiniz.';
  }
  return null;
}

function CustomRangeForm({
  initial,
  onApply,
}: {
  initial: DateRange;
  onApply: (range: DateRange) => void;
}) {
  const id = useId();
  const [start, setStart] = useState(() => toInputDate(initial.start));
  const [end, setEnd] = useState(() => toInputDate(initial.end));
  const [submitted, setSubmitted] = useState(false);
  const problem = rangeProblem(start, end);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!problem) {
      onApply({ end: fromInputDate(end), start: fromInputDate(start) });
    }
  };

  return (
    <form onSubmit={submit} {...props(styles.form)}>
      <DialogHeader>
        <DialogTitle>Özel tarih aralığı</DialogTitle>
        <DialogDescription>
          GİB’deki belgeler bu iki tarih arasında, iki gün de dahil listelenir.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-start`}>Başlangıç</FieldLabel>
          <Input
            aria-describedby={submitted && problem ? `${id}-error` : undefined}
            autoFocus
            id={`${id}-start`}
            onChange={(event) => setStart(event.target.value)}
            type="date"
            value={start}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-end`}>Bitiş</FieldLabel>
          <Input
            aria-describedby={submitted && problem ? `${id}-error` : undefined}
            id={`${id}-end`}
            onChange={(event) => setEnd(event.target.value)}
            type="date"
            value={end}
          />
          {submitted && problem && <FieldError id={`${id}-error`}>{problem}</FieldError>}
        </Field>
      </FieldGroup>
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
        <DialogContent showCloseButton={false}>
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
