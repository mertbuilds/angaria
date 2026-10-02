import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@angaria/ui';
import { Building2Icon, FilePlusIcon, RepeatIcon } from 'lucide-react';
import { useStore } from '@/lib/store.tsx';
import { sections } from './nav.ts';
import { useAppActions } from './use-app-actions.ts';

// Every typed word must appear in the item's text or keywords, compared
// without Turkish diacritics ("musteri" finds "Müşteriler"). cmdk's fuzzy
// default lets stray letters match, and its group sorting never reorders.
const fold = (text: string) =>
  text.toLocaleLowerCase('tr').replaceAll('ı', 'i').normalize('NFD').replaceAll(/\p{M}/gu, '');

const commandProps = {
  filter: (value: string, search: string, keywords: Array<string> = []) => {
    const text = fold([value, ...keywords].join(' '));
    return fold(search)
      .split(/\s+/)
      .every((word) => text.includes(word))
      ? 1
      : 0;
  },
};

export function CommandPalette({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const { goTo, newInvoice, reissueLastMonth } = useAppActions();
  const { activeEntityId, entities, setActiveEntityId } = useStore();
  const otherEntities = entities.filter((entity) => entity.id !== activeEntityId);

  const run = (action: () => void) => () => {
    onOpenChange(false);
    action();
  };

  return (
    <CommandDialog commandProps={commandProps} onOpenChange={onOpenChange} open={open}>
      <CommandInput placeholder="Ne yapmak istiyorsun?" />
      <CommandList>
        <CommandEmpty>Sonuç yok</CommandEmpty>
        <CommandGroup heading="Fatura">
          <CommandItem keywords={['kes', 'oluştur', 'taslak']} onSelect={run(newInvoice)}>
            <FilePlusIcon />
            Yeni fatura
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem keywords={['kopyala', 'aylık', 'tekrarla']} onSelect={run(reissueLastMonth)}>
            <RepeatIcon />
            Geçen ayın faturasını tekrar kes
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Git">
          {sections
            .filter((section) => section.to !== '/yeni')
            .map((section) => (
              <CommandItem key={section.to} onSelect={run(() => goTo(section.to))}>
                <section.icon />
                {section.label}
                <CommandShortcut>{section.shortcut}</CommandShortcut>
              </CommandItem>
            ))}
        </CommandGroup>
        {otherEntities.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Şirket değiştir">
              {otherEntities.map((entity) => (
                <CommandItem
                  key={entity.id}
                  keywords={['şirket', 'firma', entity.companyInfo.name]}
                  onSelect={run(() => setActiveEntityId(entity.id))}
                  value={`${entity.name} ${entity.id}`}
                >
                  <Building2Icon />
                  {entity.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
