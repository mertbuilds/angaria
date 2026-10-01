import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const p = (n: number) => String(n).padStart(2, '0');

export function TimePicker({
  value,
  onChange,
  placeholder = 'HH:MM:SS',
}: {
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(raw: string) {
    // Strip non-digits
    const digits = raw.replaceAll(/\D/g, '').slice(0, 6);

    // Auto-insert colons
    let formatted = '';
    for (let i = 0; i < digits.length; i++) {
      if (i === 2 || i === 4) {
        formatted += ':';
      }
      formatted += digits[i];
    }
    onChange(formatted);
  }

  function setNow() {
    const now = new Date();
    onChange(`${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`);
    inputRef.current?.focus();
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        className="tabular-nums"
        maxLength={8}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        ref={inputRef}
        value={value}
      />
      <Button onClick={setNow} size="sm" type="button" variant="outline">
        Şimdi
      </Button>
    </div>
  );
}
