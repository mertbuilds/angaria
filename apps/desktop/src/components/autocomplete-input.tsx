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
  className?: string;
  onChange: (value: string) => void;
  onCreate?: (value: string) => void;
  onSelect: (id: string) => void;
  placeholder?: string;
  suggestions: Array<{ id: string; label: string }>;
  value: string;
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
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className={cn(
            'w-[240px] justify-between font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
          role="combobox"
          size="sm"
          variant="outline"
        >
          <span className="truncate">{value || placeholder}</span>
          <HugeiconsIcon
            className="ml-auto size-4 shrink-0 opacity-50"
            icon={ArrowDown01Icon}
            strokeWidth={1.5}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput onValueChange={setSearch} placeholder="Ara veya yaz..." value={search} />
          <CommandList>
            <CommandEmpty>
              {search.trim() ? (
                <button
                  className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    const val = search.trim();
                    onChange(val);
                    onCreate?.(val);
                    setSearch('');
                    setOpen(false);
                  }}
                  type="button"
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
                    data-checked={s.label === value}
                    key={s.id}
                    onSelect={() => {
                      onSelect(s.id);
                      setSearch('');
                      setOpen(false);
                    }}
                    value={s.label}
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
