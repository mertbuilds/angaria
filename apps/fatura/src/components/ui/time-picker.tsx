import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function TimePicker({
  value,
  onChange,
  placeholder = "HH:MM:SS",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(raw: string) {
    // Strip non-digits
    const digits = raw.replace(/\D/g, "").slice(0, 6);

    // Auto-insert colons
    let formatted = "";
    for (let i = 0; i < digits.length; i++) {
      if (i === 2 || i === 4) formatted += ":";
      formatted += digits[i];
    }
    onChange(formatted);
  }

  function setNow() {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    onChange(`${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`);
    inputRef.current?.focus();
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="tabular-nums"
        maxLength={8}
      />
      <Button type="button" variant="outline" size="sm" onClick={setNow}>
        Şimdi
      </Button>
    </div>
  );
}
