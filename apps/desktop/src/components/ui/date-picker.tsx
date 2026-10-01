import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  className?: string;
  maxDate?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  value: Date | undefined;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Tarih seçin',
  className,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
          variant="outline"
        >
          {value ? format(value, 'PPP', { locale: tr }) : placeholder}
          <HugeiconsIcon
            className="size-4 opacity-50"
            data-icon="inline-end"
            icon={ArrowDown01Icon}
            strokeWidth={1.5}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto overflow-hidden p-0">
        <Calendar
          captionLayout="dropdown"
          defaultMonth={value}
          disabled={maxDate ? { after: maxDate } : undefined}
          locale={tr}
          mode="single"
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
          selected={value}
        />
        <div className="border-t p-2">
          <Button
            className="w-full"
            onClick={() => {
              onChange(new Date());
              setOpen(false);
            }}
            size="sm"
            variant="ghost"
          >
            Bugün
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
