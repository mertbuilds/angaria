import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (id: string) => void;
  onCreate?: (value: string) => void;
  suggestions: { id: string; label: string }[];
  placeholder?: string;
  className?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  onSelect,
  onCreate,
  suggestions,
  placeholder,
  className,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-[240px] justify-between font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={1.5}
            className="ml-auto size-4 shrink-0 opacity-50"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Ara veya yaz..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {search.trim() ? (
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    const val = search.trim();
                    onChange(val);
                    onCreate?.(val);
                    setSearch('');
                    setOpen(false);
                  }}
                >
                  &ldquo;{search.trim()}&rdquo; olarak kullan
                </button>
              ) : (
                'Sonuç yok'
              )}
            </CommandEmpty>
            <CommandGroup>
              {suggestions
                .filter((s) => s.label.toLowerCase().includes(search.toLowerCase()))
                .map((s) => (
                  <CommandItem
                    key={s.id}
                    value={s.label}
                    data-checked={s.label === value}
                    onSelect={() => {
                      onSelect(s.id);
                      setSearch('');
                      setOpen(false);
                    }}
                  >
                    {s.label}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
